import { bash_exec, pwsh_exec, where_command } from './exec.mjs'
import process, { env } from 'node:process'

// --- 内部辅助函数 ---

/**
 * 在 sway/wlroots 窗口树中递归查找当前聚焦的节点。
 * @private
 * @param {object} node - 树的当前节点。
 * @returns {object | null} - 返回聚焦的节点，如果未找到则返回 null。
 */
function findFocusedNodeInSwayTree(node) {
	if (node.focused) return node
	for (const child of (node.nodes || []).concat(node.floating_nodes || [])) {
		const focused = findFocusedNodeInSwayTree(child)
		if (focused) return focused
	}
	return null
}

/**
 * 在 sway/wlroots 窗口树中递归提取所有窗口的信息。
 * @private
 * @param {object} node - 树的当前节点。
 * @param {Array<object>} windows - 用于累积窗口信息的数组。
 */
function extractWindowsFromSwayTree(node, windows) {
	if (node.pid && node.name && !node.nodes?.length)
		windows.push({
			pid: node.pid,
			processName: node.app_id || 'unknown',
			path: 'N/A on Wayland',
			title: node.name,
			identifier: node.pid,
		})

	for (const child of (node.nodes || []).concat(node.floating_nodes || []))
		extractWindowsFromSwayTree(child, windows)

}


// --- 核心功能函数 ---

/**
 * 获取当前活跃窗口的唯一标识符。
 * 支持 Windows, macOS, Linux (X11 和部分 Wayland 环境)。
 * @private
 * @returns {Promise<number | string | null>} - 返回窗口的标识符 (PID 或窗口 ID)，失败则返回 null。
 */
async function getActiveWindowIdentifier() {
	try {
		switch (process.platform) {
			case 'win32': {
				// Windows: 使用 PowerShell 调用 User32.dll API 获取前台窗口的 PID。
				// 这是一个高效且无需第三方依赖的实现方式。
				const script = `\
Add-Type @"
	using System; using System.Runtime.InteropServices;
	public class User32 {
		[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
		[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
	}
"@
$hwnd = [User32]::GetForegroundWindow()
$windowpid = 0
[User32]::GetWindowThreadProcessId($hwnd, [ref]$windowpid) | Out-Null
return $windowpid
`
				const { stdout, code } = await pwsh_exec(script)
				if (code !== 0 || !stdout) return null
				return parseInt(stdout.trim(), 10)
			}

			case 'darwin': {
				// macOS: 使用 AppleScript 获取最前端应用的进程ID (PID)。
				const command = 'osascript -e \'tell application "System Events" to get unix id of first process whose frontmost is true\''
				const { stdout, code } = await bash_exec(command)
				if (code !== 0 || !stdout) return null
				return parseInt(stdout.trim(), 10)
			}

			case 'linux': {
				if (env.XDG_SESSION_TYPE === 'wayland') {
					const desktop = env.XDG_CURRENT_DESKTOP?.toLowerCase()
					// Wayland: 目前仅支持 sway 和 hyprland，它们使用兼容的 swaymsg IPC 接口。
					if (desktop?.includes('sway') || desktop?.includes('hyprland')) {
						const swaymsgPath = await where_command('swaymsg')
						if (!swaymsgPath) {
							console.warn('swaymsg command not found, cannot get active window on this Wayland session.')
							return null
						}
						const { stdout } = await bash_exec(`${swaymsgPath} -t get_tree`)
						const tree = JSON.parse(stdout)
						const activeNode = findFocusedNodeInSwayTree(tree)
						return activeNode ? activeNode.pid : null
					}
					// 对于尚不支持的 Wayland 桌面环境，打印警告信息。
					console.warn(`Cannot get active window: your Wayland desktop environment ("${desktop || 'unknown'}") is not yet supported.`)
					return null
				} else { // X11 session
					const xpropPath = await where_command('xprop')
					if (!xpropPath) {
						console.warn('xprop command not found, cannot get active window on this X11 session.')
						return null
					}
					// X11: 使用 xprop 获取根窗口的 _NET_ACTIVE_WINDOW 属性，从中解析出窗口ID。
					const command = `${xpropPath} -root _NET_ACTIVE_WINDOW`
					const { stdout, code } = await bash_exec(command)
					if (code !== 0 || !stdout) return null
					const match = stdout.match(/window id # (0x[0-9a-fA-F]+)/)
					return match ? match[1] : null
				}
			}
			default:
				return null
		}
	} catch (e) {
		// 捕获并记录执行过程中发生的任何错误。
		console.error('Error getting active window identifier:', e instanceof Error ? e.message : String(e))
		return null
	}
}


/**
 * 获取所有可见窗口的详细信息列表。
 * @private
 * @returns {Promise<Array<{pid: number, processName: string, path: string, title: string, identifier: number|string}>>} - 返回一个包含窗口信息的对象数组。
 * @throws {Error} 如果在当前平台获取窗口列表失败。
 */
async function getAllWindows() {
	switch (process.platform) {
		case 'win32': {
			// Windows: 使用 Get-Process 获取有主窗口标题的进程。
			// Path 属性可能为空 (例如系统进程)，因此进行优雅处理，记为 'N/A'。
			const command = 'Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, Path, MainWindowTitle | ConvertTo-Json -Compress'
			const { stdout, stderr, code } = await pwsh_exec(command)

			if (code !== 0 || !stdout)
				throw new Error(`Failed to get window details on Windows: ${stderr || 'No output'}`)


			// PowerShell 在只有一个结果时可能返回单个对象而非数组，此处进行兼容性处理。
			const processes = JSON.parse(stdout)
			const processArray = Array.isArray(processes) ? processes : [processes]

			return processArray.map(p => ({
				pid: p.Id,
				processName: p.ProcessName,
				path: p.Path || 'N/A',
				title: p.MainWindowTitle,
				identifier: p.Id,
			}))
		}

		case 'darwin': {
			// macOS: 使用 osascript (JavaScript for Automation) 来获取窗口信息。
			// 直接输出 JSON 格式可以有效避免手动解析字符串的复杂性和潜在错误，
			// 尤其是在窗口标题包含特殊字符时。
			const command = `osascript -l JavaScript -e '
    function run() {
        const systemEvents = Application("System Events");
        const procs = systemEvents.processes.whose({
            backgroundOnly: false,
            name: {"<>": "Finder"} // 排除 Finder 自身
        });

        const windows = [];
        for (let i = 0; i < procs.length; i++) {
            const p = procs[i];
            try {
                if (p.windows.length > 0) {
                    windows.push({
                        pid: p.unixId(),
                        processName: p.name(),
                        path: p.applicationFile().posixPath(),
                        title: p.windows[0].name(),
                        identifier: p.unixId()
                    });
                }
            } catch (e) {
                // 忽略无法访问的进程 (例如权限不足)
            }
        }
        return JSON.stringify(windows);
    }
'`
			const { stdout, stderr, code } = await bash_exec(command)
			if (code !== 0 || !stdout)
				throw new Error(`Failed to get window details on macOS: ${stderr || 'No output'}`)

			return JSON.parse(stdout)
		}

		case 'linux': {
			if (env.XDG_SESSION_TYPE === 'wayland') {
				const desktop = env.XDG_CURRENT_DESKTOP?.toLowerCase()
				if (desktop?.includes('sway') || desktop?.includes('hyprland')) {
					const swaymsgPath = await where_command('swaymsg')
					if (!swaymsgPath) throw new Error('swaymsg is required but not found for this Wayland session.')

					const { stdout, code, stderr } = await bash_exec(`${swaymsgPath} -t get_tree`)
					if (code !== 0) throw new Error(`swaymsg failed: ${stderr}`)

					const tree = JSON.parse(stdout)
					const windows = []
					extractWindowsFromSwayTree(tree, windows)
					return windows
				}
				// 对于不支持的 Wayland 环境，抛出信息明确的错误，
				// 告知用户当前仅支持 sway/hyprland，并提及未来的支持方向。
				throw new Error(
					`Listing all windows on Wayland is not yet supported for your desktop environment ("${desktop || 'unknown'}"). ` +
					'Support for GNOME/KDE is planned for a future update. ' +
					'Currently, only sway/hyprland are supported.'
				)
			} else { // X11 session
				const wmctrlPath = await where_command('wmctrl')
				if (!wmctrlPath) throw new Error('wmctrl is required but not found for this X11 session.')

				const { stdout: wmctrlOut, code } = await bash_exec(`${wmctrlPath} -lp`)
				if (code !== 0 || !wmctrlOut) return []

				const lines = wmctrlOut.trim().split('\n')
				const windowPromises = lines.map(async (line) => {
					// 使用正则表达式解析 wmctrl 的输出
					const match = line.match(/^(\S+)\s+\S+\s+(\d+)\s+\S+\s+(.*)$/)
					if (!match) return null

					const [, windowId, pidStr, title] = match
					const pid = parseInt(pidStr, 10)
					if (isNaN(pid) || pid === 0) return null // 过滤无效PID

					try {
						// 并行查询每个窗口 PID 对应的可执行文件路径和进程名。
						// 使用 Promise.allSettled 确保即使某个查询失败（例如进程已退出），其他查询也能继续。
						const [pathResult, nameResult] = await Promise.allSettled([
							bash_exec(`readlink -f /proc/${pid}/exe`),
							bash_exec(`cat /proc/${pid}/comm`)
						])

						// 如果查询失败，记录警告信息，但允许程序继续处理其他窗口。
						if (pathResult.status === 'rejected' || pathResult.value.code !== 0)
							console.warn(`Could not determine path for PID ${pid}. It might be a kernel process or has already exited.`)

						if (nameResult.status === 'rejected' || nameResult.value.code !== 0)
							console.warn(`Could not determine process name for PID ${pid}.`)


						return {
							pid,
							processName: nameResult.status === 'fulfilled' && nameResult.value.stdout ? nameResult.value.stdout.trim() : 'unknown',
							path: pathResult.status === 'fulfilled' && pathResult.value.stdout ? pathResult.value.stdout.trim() : 'N/A',
							title: title.trim(),
							identifier: windowId,
						}
					} catch (e) {
						// 捕获在处理单个 PID 过程中可能发生的意外错误。
						console.error(`An unexpected error occurred while processing PID ${pid}:`, e)
						return null
					}
				})

				const results = await Promise.all(windowPromises)
				return results.filter(Boolean) // 过滤掉处理失败或无效的窗口条目。
			}
		}
		default:
			throw new Error(`Unsupported platform: ${process.platform}`)
	}
}


/**
 * 获取所有窗口的详细信息，并附带一个标志指示哪个窗口是当前活跃的。
 * 本函数整合了获取所有窗口和获取当前活跃窗口的功能。
 * @returns {Promise<Array<{pid: number, processName: string, path: string, title: string, isActive: boolean}>>} - 返回一个包含所有窗口信息的数组，每个窗口对象都包含一个 `isActive` 布尔值。
 */
export async function getWindowInfos() {
	// 并行获取“当前活跃窗口的标识符”和“所有窗口的列表”。
	const [activeIdentifier, allWindows] = await Promise.all([
		getActiveWindowIdentifier(),
		getAllWindows()
	])

	if (!allWindows || allWindows.length === 0) return []

	return allWindows.map(window => {
		const { identifier, ...windowInfo } = window
		return {
			...windowInfo,
			isActive: activeIdentifier !== null && identifier === activeIdentifier,
		}
	})
}
