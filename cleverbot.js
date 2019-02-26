/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Cleverbot',
    version: '1.0',
    description: 'Talk to cleverbot by using the ask command or in a specified channel.',
    author: 'Jonas Bögle <jonas@boegle.me>',
    backends: ['ts3', 'discord'],
    engine: '>=1.0.0',
    requiredModules: ['http', 'discord-dangerous'],
    vars: [
        {
            name: 'channel',
            title: 'Channel ID',
            type: 'string'
        },
        {
            name: 'minDelay',
            title: 'Minimum Delay',
            default: 1000,
            type: 'number'
        },
        {
            name: 'tts',
            title: 'TTS (text to speech)',
            default: false,
            type: 'checkbox'
        }
    ]
}, (_, {channel, minDelay, tts}, meta) => {
    const http = require('http')
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const helpers = require('helpers')
    const audio = require('audio')

    class Cleverbot {
        constructor() {
            this.base = 'https://www.cleverbot.com/'
            this.api = this.base+'/webservicemin?uc=UseOfficialCleverbotAPI&'
            this.defaultTimeout = 10 * 1000
            this.savelines = 100

            this.lines = []
        }

        /**
         * Creates a new session.
         * @param {function} callback
         */
        init(callback=()=>{}) {
            this._send('GET', this.base, null, (error, response) => {
                if (error) {
                    engine.log(`HTTP Error: ${error}`)
                    if (typeof callback === 'function') callback(`HTTP Error: ${error}`)
                    return
                }
                
                this.XVIS = Cleverbot._getCookie('XVIS', response.headers)

                if (this.XVIS) {
                    //engine.log(`XVIS: ${this.XVIS}`)
                    if (typeof callback === 'function') callback()
                } else {
                    engine.log('Error: cookie not found')
                    if (typeof callback === 'function') callback('Error: cookie not found')
                }
            })
        }

        /**
         * Ask Cleverbot something.
         * @param {string} input 
         * @param {function} callback 
         * @param {number} retrys Take it or leave it.
         */
        ask(input, callback, retrys=3) {
            this.lines.push(input)

            let url = this.api

            // if (this.sessionid) {
            //     url += getLoggingParameters(cleverbot.reply, input);
            // }

            let body = `stimulus=${Cleverbot._encode(input)}`
            // this.lang = this._guessLanguage(input);
            // if (this.lang) {
            //     body += ('&cb_settings_language=' + this.lang);
            // }
            body += '&cb_settings_scripting=no';
            // if (this.sessionid) {
            //     body += `&sessionid=${this.sessionid}`
            // }

            body += '&islearning=1&icognoid=wsf&icognocheck=';
            body += helpers.MD5Sum(body.substring(7, 33))
            
            this._send('POST', url, body, (error, response) => {
                if (error) {
                    if (retrys <= 0) {
                        engine.log(`HTTP Error: ${error}`)
                        if (typeof callback === 'function') callback('Sorry, I was unable to process that (http error) :confused:', null)
                        return
                    } else {
                        return this.ask(input, callback, --retrys)
                    }
                }
                
                let answer = response.data.toString().split('\r')[0]
                //engine.log(`answer: ${answer}`)
                if (typeof callback === 'function') callback(undefined, answer)
            })
        }

        /**
         * @private
         * @param {string} method 
         * @param {string} url 
         * @param {string} body 
         * @param {function} callback 
         */
        _send(method, url, body, callback) {
            let cookies = this.XVIS ? `XVIS=${this.XVIS}` : null
            return http.simpleRequest({
                method: method,
                url: url,
                timeout: this.defaultTimeout,
                body: body,
                headers: {
                    'Referer': this.base,
                    'Cookie': cookies
                }
            }, callback.bind(this))
        }

        /**
         * Encodes a parameter.
         * @private
         * @static
         * @param {string} input
         * @returns {string}
         */
        static _encode(input) {
            let out = ''
            input = input.replace(/[|]/g, '{*}')
            
            for (let i = 0; i <= input.length; i++) {
                if (input.charCodeAt(i) > 255) {
                    let escapedChar = escape(input.charAt(i))
                    if (escapedChar.substring(0, 2) == '%u') {
                        out += ('|' + escapedChar.substring(2, escapedChar.length))
                    } else {
                        out += escapedChar
                    }
                } else {
                    out += input.charAt(i)
                }
            }
            out = out.replace(/\|201[CD89]|`|%B4/g, '\'').replace(/\|FF20|\|FE6B/g, '')
            return escape(out)
        }

        /**
         * Returns the value of a cookie.
         * @private
         * @static
         * @param {string} name Name
         * @param {object} headers HTTP Headers
         * @return {?string}
         */
        static _getCookie(name, headers) {
            for (let cookie of headers['Set-Cookie']) {
                cookie = cookie.split('=')

                if (cookie[0] == name) {
                    return cookie[1].split(';')[0]
                }
            }
            return null
        }
    }

    const bot = new Cleverbot()

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    event.on('load', () => {
        bot.init()

        // @ts-ignore
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')
        
        command.createCommand('ask')
        .help('Ask something')
        .manual('Ask something.')
        .addArgument(command.createArgument('rest').setName('message').min(1))
        .exec((client, args, reply, ev) => {
            let start = Date.now()
            typing(ev.channel.id())

            bot.ask(args.message, (err, response) => delay(start, () => {
                if (err) return reply(err);
                reply(response)
                if (tts) audio.say(response)
            }))
        })
    })

    event.on('chat', ev => {
        if (ev.channel.id().endsWith(channel)) {
            if (ev.text.startsWith('//') || ev.client.isSelf()) return;
            let start = Date.now()
            typing(ev.channel.id().split('/')[1])

            bot.ask(ev.text, (err, response) => delay(start, () => {
                if (err) return ev.channel.chat(err);
                ev.channel.chat(response)
                if (tts) audio.say(response)
            }))
        }
    })

    /**
     * Post a typing indicator for the specified channel.
     * @param {string} channelID
     */
    function typing(channelID) {
        // @ts-ignore
        if (channelID.includes('/')) channelID = channelID.split('/')[1];

        // @ts-ignore
        backend.extended().rawCommand('POST', `/channels/${channelID}/typing`, {}, err => {
            if (err) {
                engine.log(err)
            }
        })
    }

    /**
     * Calls a function with a minimum delay.
     * @param {number} start timestamp in ms
     * @param {function} callback
     */
    function delay(start, callback) {
        let diff = Date.now() - start

        if (diff >= minDelay) {
            callback()
        } else {
            setTimeout(callback, minDelay-diff)
        }
    }
})