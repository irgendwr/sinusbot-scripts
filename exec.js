registerPlugin({
    name: "Exec",
    version: "0.1.0",
    description: "Evaluates chat commands",
    author: "Multivitamin <david.kartnaller@gmail.com",
    backends: ["ts3", "discord"],
    requiredModules: ["http"],
    vars: [{
        name: "admins",
        title: "UIDs of users which have access to admin commands",
        type: "strings",
        default: []
    }]
}, (_, config) => {
    const engine = require("engine")
    const event = require("event")
    const format = require("format")
    // import modules for quick use in exec:
    /* eslint-disable */
    const backend = require("backend")
    const helpers = require("helpers")
    const media = require("media")
    const audio = require("audio")
    const store = require("store")
    const http = require("http")
    /* eslint-enable */

    const codeBlockPattern = /^ *```(javascript *\r?\n?)?(?<code>.*)``` *$/si

    /**
     * Checks if a client is allowed to use admin commands.
     * @param {Client} client
     * @returns {boolean}
     */
    function allowAdminCommands(client) {
        switch (engine.getBackend()) {
            case "discord":
                return config.admins.includes(client.uid().split("/")[1])
            case "ts3":
                return config.admins.includes(client.uid())
            default:
                throw new Error(`Unknown backend ${engine.getBackend()}`)
        }
    }

    // eslint-disable-next-line no-unused-vars
    function evaluate(code, ev) {
        const start = Date.now()
        let data = null
        let error = null
        try {
            // eslint-disable-next-line no-eval
            data = eval(code)
        } catch (e) {
            error = e
        }
        return {
            error,
            data,
            duration: Date.now() - start
        }
    }

    event.on("load", () => {
        const command = require("command")
        if (!command) return engine.log("Command.js not found! Please be sure to install and enable Command.js")
        const {createCommand, createArgument} = command

        createCommand("exec")
            .help("Executes a raw command within Sinusbot")
            .addArgument(createArgument("rest").setName("code"))
            .checkPermission(allowAdminCommands)
            .exec((client, {code}, reply, ev) => {
                if (engine.getBackend() === "discord") {
                    const match = code.match(codeBlockPattern)
                    if (match) code = match.groups.code
                    const res = evaluate(code, ev)
                    if (res.error) reply(`Error:\n${format.code(res.error.stack)}\nTook ${res.duration}ms`)
                    if (!res.error || res.data) reply(`${format.code(res.data)}\nTook ${res.duration}ms`)
                } else {
                    const res = evaluate(code, ev)
                    if (res.error) reply(`Error:\n${res.error.stack}\nTook: ${res.duration}ms`)
                    if (!res.error || res.data) reply(`${res.data}\nTook: ${res.duration}ms`)
                }
            })
    })
})