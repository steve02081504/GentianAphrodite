// from https://github.com/SillyTavern/SillyTavern

import { chat_metadata, saveMetadataDebounced } from "../prompt_builder.mjs";

// license as AGPL-3.0 license
function getLocalVariable(name, args = {}) {
	if (!chat_metadata.variables) {
		chat_metadata.variables = {};
	}

	let localVariable = chat_metadata?.variables[args.key ?? name];
	if (args.index !== undefined) {
		try {
			localVariable = JSON.parse(localVariable);
			const numIndex = Number(args.index);
			if (Number.isNaN(numIndex)) {
				localVariable = localVariable[args.index];
			} else {
				localVariable = localVariable[Number(args.index)];
			}
			if (typeof localVariable == 'object') {
				localVariable = JSON.stringify(localVariable);
			}
		} catch {
			// that didn't work
		}
	}

	return (localVariable === '' || isNaN(Number(localVariable))) ? (localVariable || '') : Number(localVariable);
}

function setLocalVariable(name, value, args = {}) {
	if (!chat_metadata.variables) {
		chat_metadata.variables = {};
	}

	if (args.index !== undefined) {
		try {
			let localVariable = JSON.parse(chat_metadata.variables[name] ?? 'null');
			const numIndex = Number(args.index);
			if (Number.isNaN(numIndex)) {
				if (localVariable === null) {
					localVariable = {};
				}
				localVariable[args.index] = value;
			} else {
				if (localVariable === null) {
					localVariable = [];
				}
				localVariable[numIndex] = value;
			}
			chat_metadata.variables[name] = JSON.stringify(localVariable);
		} catch {
			// that didn't work
		}
	} else {
		chat_metadata.variables[name] = value;
	}
	saveMetadataDebounced();
	return value;
}

function getGlobalVariable(name, args = {}) {
	let globalVariable = extension_settings.variables.global[args.key ?? name];
	if (args.index !== undefined) {
		try {
			globalVariable = JSON.parse(globalVariable);
			const numIndex = Number(args.index);
			if (Number.isNaN(numIndex)) {
				globalVariable = globalVariable[args.index];
			} else {
				globalVariable = globalVariable[Number(args.index)];
			}
			if (typeof globalVariable == 'object') {
				globalVariable = JSON.stringify(globalVariable);
			}
		} catch {
			// that didn't work
		}
	}

	return (globalVariable === '' || isNaN(Number(globalVariable))) ? (globalVariable || '') : Number(globalVariable);
}

function setGlobalVariable(name, value, args = {}) {
	if (args.index !== undefined) {
		try {
			let globalVariable = JSON.parse(extension_settings.variables.global[name] ?? 'null');
			const numIndex = Number(args.index);
			if (Number.isNaN(numIndex)) {
				if (globalVariable === null) {
					globalVariable = {};
				}
				globalVariable[args.index] = value;
			} else {
				if (globalVariable === null) {
					globalVariable = [];
				}
				globalVariable[numIndex] = value;
			}
			extension_settings.variables.global[name] = JSON.stringify(globalVariable);
		} catch {
			// that didn't work
		}
	} else {
		extension_settings.variables.global[name] = value;
	}
	saveSettingsDebounced();
}

function addLocalVariable(name, value) {
	const currentValue = getLocalVariable(name) || 0;
	try {
		const parsedValue = JSON.parse(currentValue);
		if (Array.isArray(parsedValue)) {
			parsedValue.push(value);
			setLocalVariable(name, JSON.stringify(parsedValue));
			return parsedValue;
		}
	} catch {
		// ignore non-array values
	}
	const increment = Number(value);

	if (isNaN(increment) || isNaN(Number(currentValue))) {
		const stringValue = String(currentValue || '') + value;
		setLocalVariable(name, stringValue);
		return stringValue;
	}

	const newValue = Number(currentValue) + increment;

	if (isNaN(newValue)) {
		return '';
	}

	setLocalVariable(name, newValue);
	return newValue;
}

function addGlobalVariable(name, value) {
	const currentValue = getGlobalVariable(name) || 0;
	try {
		const parsedValue = JSON.parse(currentValue);
		if (Array.isArray(parsedValue)) {
			parsedValue.push(value);
			setGlobalVariable(name, JSON.stringify(parsedValue));
			return parsedValue;
		}
	} catch {
		// ignore non-array values
	}
	const increment = Number(value);

	if (isNaN(increment) || isNaN(Number(currentValue))) {
		const stringValue = String(currentValue || '') + value;
		setGlobalVariable(name, stringValue);
		return stringValue;
	}

	const newValue = Number(currentValue) + increment;

	if (isNaN(newValue)) {
		return '';
	}

	setGlobalVariable(name, newValue);
	return newValue;
}

function incrementLocalVariable(name) {
	return addLocalVariable(name, 1);
}

function incrementGlobalVariable(name) {
	return addGlobalVariable(name, 1);
}

function decrementLocalVariable(name) {
	return addLocalVariable(name, -1);
}

function decrementGlobalVariable(name) {
	return addGlobalVariable(name, -1);
}

/**
 * Resolves a variable name to its value or returns the string as is if the variable does not exist.
 * @param {string} name Variable name
 * @param {SlashCommandScope} scope Scope
 * @returns {string} Variable value or the string literal
 */
export function resolveVariable(name, scope = null) {
	if (scope?.existsVariable(name)) {
		return scope.getVariable(name);
	}

	if (existsLocalVariable(name)) {
		return getLocalVariable(name);
	}

	if (existsGlobalVariable(name)) {
		return getGlobalVariable(name);
	}

	return name;
}

export function replaceVariableMacros(input) {
	const lines = input.split('\n');

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];

		// Skip lines without macros
		if (!line || !line.includes('{{')) {
			continue;
		}

		// Replace {{getvar::name}} with the value of the variable name
		line = line.replace(/{{getvar::([^}]+)}}/gi, (_, name) => {
			name = name.trim();
			return getLocalVariable(name);
		});

		// Replace {{setvar::name::value}} with empty string and set the variable name to value
		line = line.replace(/{{setvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
			name = name.trim();
			setLocalVariable(name, value);
			return '';
		});

		// Replace {{addvar::name::value}} with empty string and add value to the variable value
		line = line.replace(/{{addvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
			name = name.trim();
			addLocalVariable(name, value);
			return '';
		});

		// Replace {{incvar::name}} with empty string and increment the variable name by 1
		line = line.replace(/{{incvar::([^}]+)}}/gi, (_, name) => {
			name = name.trim();
			return incrementLocalVariable(name);
		});

		// Replace {{decvar::name}} with empty string and decrement the variable name by 1
		line = line.replace(/{{decvar::([^}]+)}}/gi, (_, name) => {
			name = name.trim();
			return decrementLocalVariable(name);
		});

		// Replace {{getglobalvar::name}} with the value of the global variable name
		line = line.replace(/{{getglobalvar::([^}]+)}}/gi, (_, name) => {
			name = name.trim();
			return getGlobalVariable(name);
		});

		// Replace {{setglobalvar::name::value}} with empty string and set the global variable name to value
		line = line.replace(/{{setglobalvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
			name = name.trim();
			setGlobalVariable(name, value);
			return '';
		});

		// Replace {{addglobalvar::name::value}} with empty string and add value to the global variable value
		line = line.replace(/{{addglobalvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
			name = name.trim();
			addGlobalVariable(name, value);
			return '';
		});

		// Replace {{incglobalvar::name}} with empty string and increment the global variable name by 1
		line = line.replace(/{{incglobalvar::([^}]+)}}/gi, (_, name) => {
			name = name.trim();
			return incrementGlobalVariable(name);
		});

		// Replace {{decglobalvar::name}} with empty string and decrement the global variable name by 1
		line = line.replace(/{{decglobalvar::([^}]+)}}/gi, (_, name) => {
			name = name.trim();
			return decrementGlobalVariable(name);
		});

		lines[i] = line;
	}

	return lines.join('\n');
}
