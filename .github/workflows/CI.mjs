const CI = fountCharCI
await CI.char.interfaces.config.SetData({
	AIsources: {
		'CI': 'CI'
	}
})
await CI.runOutput('测试！')
