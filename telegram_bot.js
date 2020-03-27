/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 * 
 * @author Jonas Bögle
 * @license MIT
 * 
 * MIT License
 * 
 * Copyright (c) 2020 Jonas Bögle
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * Thanks to Philipp (pr31337) for donating, suggesting the idea and keeping it open source!
 * 
 * Thanks to the following GitHub sponsors for supporting my work:
 * - Michael Friese
 * - Jay Vasallo
 * 
 * https://github.com/sponsors/irgendwr
 */
registerPlugin({
    name: 'Telegram Bot',
    version: '1.0.0',
    description: 'Responds to Telegram commands like `/status` and `/playing`.',
    author: 'Jonas Bögle (@irgendwr)',
    engine: '>= 1.0.0',
    backends: ['ts3', 'discord'],
    requiredModules: ['http'],
    vars: [
        // {
        //     name: 'master',
        //     title: 'Main Instance (only enable this once per Telegram bot!)',
        //     type: 'checkbox',
        //     default: true,
        // },
        {
            name: 'message',
            title: 'Message (placeholders: channellist, clientcount, userid, chatid, username, first_name, last_name)',
            type: 'multiline',
            placeholder: `Example:\n{clientcount} clients online:\n{channellist}`,
            default: `{clientcount} clients online:\n{channellist}`,
        },
        {
            name: 'help',
            title: '/help Message',
            type: 'multiline',
            default: `Commands:
/help - Shows this message
/status - Shows clients
/playing - Shows currently playing song
/about - About this bot`,
            // conditions: [{ field: 'master', value: true }],
        },
        {
            name: 'token',
            title: 'Telegram Bot Token from @BotFather (https://t.me/BotFather)',
            type: 'password',
            placeholder: '',
            // conditions: [{ field: 'master', value: true }],
        },
    ]
}, (_, config, meta) => {
    const engine = require('engine')
    const event = require('event')
    const backend = require('backend')
    const http = require('http')
    const store = require('store')
    const audio = require('audio')
    const media = require('media')

    // const MASTER = config.master;
    const TOKEN = config.token;

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`);
    // engine.log(`master=${config.master}`);

    // // NON-MASTER SECTION
    // if (!MASTER) {
    //     event.on('telegramstatus', ev => {
    //         engine.log('Status event!');
    //         // ev.respond(format(config.message, {msg: ev.msg}, placeholders));
    //     })
    //     return;
    // }

    // check if bot token is set
    if (!TOKEN) {
        engine.log('Please set the Telegram Bot Token in the script config.');
        engine.notify('Please set the Telegram Bot Token in the script config.');
        return;
    }

    const CLIENT_PREFIX = "  ";
    // Maximum retries after which to top querying.
    const MAX_RETRIES = 5;
    // Interval in which to check for new messages.
    const INTERVAL = 30; // seconds
    // Request Timeout
    const TIMEOUT = INTERVAL;

    let bot;
    telegram('getMe').then(user => { bot = user; }).catch(err => {
        engine.log(`Error on getMe: ${err}`);
    });

    // clear webhook
    telegram('setWebhook', {
        url: '',
    }).catch(err => {
        engine.log(`Error while clearing webhook: ${err}`);
    });

    // error counter
    let errors = 0;
    // update offset
    let offset = store.getInstance('offset') || null;
    let intervalID;

    startPolling();

    function startPolling() {
        // clear previous interval
        if (intervalID) stopPolling();

        // start interval
        intervalID = setInterval(queryTelegram, INTERVAL * 1000 + 100 /* milliseconds */);

        // poll now
        queryTelegram();
    }

    function stopPolling() {
        clearInterval(intervalID);
    }

    function queryTelegram() {
        telegram('getUpdates', {
            timeout: TIMEOUT+2, // long polling
            allowed_updates: ['message'], // only update on messages
            offset: offset, // start after last update
        }).then(updates => {
            // set offset, so we don't read the same messages multiple times
            offset = updates[updates.length-1].update_id + 1;

            updates.forEach(update => {
                const msg = update.message;
                // ignore non-message updates
                if (!msg) return engine.log(`ignoring non-message update: ${update}`);

                handleMessage(msg);
            });

            // reset error counter
            errors = 0;

            // update offset in storage
            store.setInstance('offset', offset);

            // restart polling
            startPolling();
        })
        .catch(err => {
            // ignore timeouts since we are using long polling
            if (typeof err === 'string' && err.includes('Timeout exceeded while awaiting headers')) return;

            if (err === 'Unexpected status code: 409') {
                engine.log('Polling Error. This happens when you enable the script more than once.');
                // ...or if anyone messes up the TIMEOUT(s) or webhook is still set
            } else {
                engine.log(err);
            }

            errors++;
            
            if (errors > MAX_RETRIES) {
                engine.log('Aborting due to too many Telegram API errors. Please restart the script by pressing "Save Changes" in the script settings.');
                stopPolling();
            }
        });
    }

    function handleMessage(msg) {
        let text = msg.text || '';

        engine.log(`received '${text}' from ${msg.chat.id} (${msg.chat.type})`);

        text = text.replace(`@${bot.username}`, '');

        switch (msg.text) {
        case '/start':
        case '/help':
            handleHelp(msg);
            break;
        case '/playing':
            handlePlaying(msg);
            break;
        case '/online':
        case '/status':
            handleStatus(msg);
            break;
        case '/about':
            handleAbout(msg);
            break;
        }
    }

    const placeholders = {
        userid: ctx => ctx.msg.from.id || '',
        chatid: ctx => ctx.msg.chat.id || '',
        username: ctx => ctx.msg.from.username || '',
        first_name: ctx => ctx.msg.from.first_name || '',
        last_name: ctx => ctx.msg.from.last_name || '',
        clientcount: () => backend.getChannels().reduce((sum, c) => sum + c.getClientCount(), 0),
        channellist: () => {
            let list = '';

            backend.getChannels()
            .sort((a, b) => a.position() - b.position())
            .forEach(channel => {
                let clients = channel.getClients();
                // ignore empty channels
                if (!clients || clients.length === 0) return;

                list += `${channel.name()}:`;
                clients.sort().forEach(client => {
                    list += `\n${CLIENT_PREFIX}${client.name()}`
                });
                list += '\n';
            });

            return list;
        },
    }

    function handleHelp(msg) {
        sendMessage(msg.chat.id, config.help)
        .catch(err => {
            engine.log(err);
        });
    }

    function handlePlaying(msg) {
        let response = 'There is nothing playing at the moment.';
        if (audio.isPlaying()) {
            response = formatTrack(media.getCurrentTrack());
        }

        sendMessage(msg.chat.id, response)
        .catch(err => {
            engine.log(err);
        });
    }

    function handleStatus(msg) {
        sendMessage(msg.chat.id, format(config.message, {msg: msg}, placeholders))
        .catch(err => {
            engine.log(err);
        });

        // this doesn't work due to a bug in the SinusBot :(

        // try {
        //     event.broadcast('telegramstatus', {
        //         msg: msg,
        //         respond: text => {
        //             sendMessage(msg.chat.id, text)
        //             .catch(err => {
        //                 engine.log(err);
        //             });
        //         },
        //     });
        // } catch (error) {
        //     engine.log(`Error on broadcast: ${error}`);
        // }
    }

    function handleAbout(msg) {
        sendMessage(msg.chat.id, 'This bot was developed by <a href="https://github.com/irgendwr">Jonas Bögle</a>. Check out the <a href="https://github.com/irgendwr/sinusbot-scripts/blob/master/telegram_bot.js">code on GitHub</a>.', 'HTML')
        .catch(err => {
            engine.log(err);
        });
    }

    /**
     * Sends a Telegram text message.
     * @param {(string|number)} chat Chat ID
     * @param {string} text Message Text
     * @param {string} [mode] Parse Mode (Markdown/HTML)
     */
    function sendMessage(chat, text, mode=null) {
        let data = {
            'chat_id': chat,
            'text':  text,
        };

        if (mode) data.parse_mode = mode;

        return telegram('sendMessage', data);
    }

    /**
     * Executes a Telegram API call
     * @param {string} method Telegram API Method
     * @param {object} [data] json data
     * @return {Promise<object>}
     * @author Jonas Bögle
     * @license MIT
     */
    function telegram(method, data=null) {
        return new Promise((resolve, reject) => {
            http.simpleRequest({
                method: 'POST',
                url: `https://api.telegram.org/bot${TOKEN}/${method}`,
                timeout: TIMEOUT * 1000,
                body: data != null ? JSON.stringify(data) : data,
                headers: {
                    'Content-Type': 'application/json'
                }
            }, (error, response) => {
                // check for lower level request errors
                if (error) {
                    return reject(error);
                }
                
                // check if status code is OK (200)
                if (response.statusCode != 200) {
                    switch (response.statusCode) {
                        case 400: reject('Bad Request. Either an invalid configuration or error in the code.'); break;
                        case 401: reject('Invalid Bot Token'); break;
                        case 404: reject('Invalid Bot Token or Method'); break;
                        default: reject(`Unexpected status code: ${response.statusCode}`);
                    }
                    return;
                }

                // parse JSON response
                var res;
                try {
                    res = JSON.parse(response.data.toString());
                } catch (err) {
                    engine.log(err.message || err);
                }
                
                // check if parsing was successfull
                if (res === undefined) {
                    return reject("Invalid JSON");
                }

                // check for api errors
                if (!res.ok) {
                    engine.log(response.data.toString());
                    return reject(`API Error: ${res.description || 'unknown'}`);
                }
                
                // success!
                resolve(res.result);
            });
        });
    }

    /**
     * Formats a string with placeholders.
     * @param {string} str Format String
     * @param {*}      ctx Context
     * @param {object} placeholders Placeholders
     * @author Jonas Bögle
     * @license MIT
     */
    function format(str, ctx, placeholders) {
        return str.replace(/((?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{([0-9_\-a-zA-Z]+)(?:\((.+)\))?\})/g, (m, str, placeholder, argsStr) => {
            if (str) {
                return str.replace(/(?:{{)|(?:}})/g, m => m[0]);
            } else {
                if (!placeholders.hasOwnProperty(placeholder) || typeof placeholders[placeholder] !== 'function') {
                    engine.log(`Unknown placeholder: ${placeholder}`);
                    return `{${placeholder}: unknown placeholder}`;
                }
                let args = [];
                if (argsStr && argsStr.length > 0) {
                    args = argsStr.split(/\s*(?<!\\)(?:,|$)\s*/);
                    args.map(arg => arg.replace('\\,', ','));
                }

                let result = `{${placeholder}: empty}`;
                try {
                    result = placeholders[placeholder](ctx, ...args);
                } catch(ex) {
                    result = `{${placeholder}: error}`;
                    engine.log(`placeholder "${placeholder}" caused an error: ${ex}`);
                }

                return result;
            }
        });
    }

    /**
     * Returns a formatted string from a track.
     *
     * @param {Track} track
     * @returns {string} formatted string
     * @author Jonas Bögle
     * @license MIT
     */
    function formatTrack(track) {
        let title = track.tempTitle() || track.title();
        let artist = track.tempArtist() || track.artist();
        return artist ? `${artist} - ${title}` : title;
    }
});
