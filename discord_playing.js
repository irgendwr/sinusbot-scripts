/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Show playing Song in Discord',
    version: '1.0.0',
    description: 'Shows the playing Song in Discord and adds rich-embedd to playing command.',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['discord'],
    requiredModules: ['discord-dangerous'],
    vars: [
        {
            name: 'text',
            title: 'Text: Use %a for artist, %t for title or %s for a combination of both (preferred)',
            type: 'string',
            placeholder: '%s',
            default: '%s',
        },
        {
            name: 'url',
            title: 'URL to Webinterface (optional, for rich-embed)',
            type: 'string',
            placeholder: 'i.e. https://sinusbot.example.com'
        }
    ]
}, (_, {text, url}, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const audio = require('audio')
    const media = require('media')
    const store = require('store')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    const PREV = '⏮'
    const PLAYPAUSE = '⏯'
    const NEXT = '⏭'

    let last_cid, last_mid;

    event.on('load', () => {
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')
        
        command.createCommand('playing')
        .help('Show what\'s currantly playing')
        .manual('Show what\'s currantly playing')
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @type {Message} */ev) => {
            if (!audio.isPlaying()) {
                return reply('There is nothing playing at the moment.')
            }

            

            backend.extended().createMessage(ev.channel.id(), getPlayingEmbed(), (err, res) => {
                if (err) return engine.log(err)

                const {id, channel_id} = JSON.parse(res)

                last_mid = id
                last_cid = channel_id

                wait(1000)
                .then(() => createReaction(channel_id, id, PREV))
                .then(() => wait(150))
                .then(() => createReaction(channel_id, id, PLAYPAUSE))
                .then(() => wait(150))
                .then(() => createReaction(channel_id, id, NEXT))
                .finally(() => engine.log('added reactions'))
            })
        })
    })

    event.on('discord:MESSAGE_REACTION_ADD', ev => {
        const emoji = (ev.emoji.id || '') + ev.emoji.name

        if (![PREV, PLAYPAUSE, NEXT].includes(emoji)) return;
        if (backend.getBotClientID().endsWith(ev.user_id)) return;

        const client = backend.getClientByID((ev.guild_id ? ev.guild_id+'/' : '')+ev.user_id)
        if (client) {
            if (client.isSelf()) return;
            if (hasPlaybackPermission(client)) {
                switch (emoji) {
                case PREV:
                    media.playPrevious()
                    break
                case PLAYPAUSE:
                    if (audio.isPlaying()) {
                        store.set('pos', audio.getTrackPosition())
                        media.stop()
                    } else {
                        if (media.getCurrentTrack()) {
                            media.getCurrentTrack().play()
                        }
                        const pos = store.get('pos') || 0
                        audio.seek(pos)
                    }
                    break
                case NEXT:
                    media.playNext()
                }
            } else {
                engine.log(`${client.nick()} is missing playback permissions for reaction controls`)
            }
        }
        deleteUserReaction(ev.channel_id, ev.message_id, ev.user_id, emoji)
    })

    event.on('track', onChange)
    event.on('trackInfo', onChange)
    event.on('trackEnd', () => {
        backend.getBotClient().setDescription('')
    })

    /**
     * Called when track or it's info changes
     * @param {Track} track
     */
    function onChange(track) {
        let title = track.tempTitle() || track.title()
        let artist = track.tempArtist() || track.artist()

        let str = text.replace(/%t/gi, title)
        .replace(/%a/gi, artist)
        .replace(/%s/gi, artist ? `${artist} - ${title}` : title)
        backend.getBotClient().setDescription(str)

        // TODO: update last embed
    }

    /**
     * Returns embed for current track
     */
    function getPlayingEmbed() {
        let track = media.getCurrentTrack();
        let title = track.tempTitle() || track.title()
        let artist = track.tempArtist() || track.artist()
        let album = track.album()
        let duration = track.duration()

        let fields = []
        fields.push({
            name: "Duration",
            value: duration ? timestamp(duration) : 'stream',
            inline: true
        })
        if (album) {
            fields.push({
                name: "Album",
                value: album,
                inline: true
            })
        }

        return {
            embed: {
                title: artist ? `${artist} - ${title}` : title,
                url: url ? url : null,
                color: 0xe13438,
                thumbnail: {
                    url: url && track.thumbnail() ? `${url}/cache/${track.thumbnail()}` : null
                },
                fields: fields,
                /*footer: {
                    icon_url: "https://sinusbot.github.io/logo.png",
                    text: "SinusBot"
                }*/
            }
        };
    }

    /**
     *
     * @param {number} milliseconds
     */
    function timestamp(milliseconds) {
        const SECOND = 1000
        const MINUTE = 60 * SECOND
        const HOUR = 60 * MINUTE

        let seconds = Math.floor(milliseconds / SECOND)
        let minutes = Math.floor(milliseconds / MINUTE)
        let hours = Math.floor(milliseconds / HOUR)
        
        minutes = minutes % (HOUR/MINUTE)
        seconds = seconds % (MINUTE/SECOND)

        let str = ''

        if (hours !== 0) {
            str += hours + ':'
            if (minutes <= 9) {
                str += '0'
            }
        }
        str += minutes + ':'
        if (seconds <= 9) {
            str += '0'
        }
        str += seconds

        return str
    }

    /**
     * Checks if a client has the necessary permissons
     * @param {Client} client
     * @returns {boolean} true if client has permission
     * @requires engine
     */
    function hasPlaybackPermission(client) {
        // try to find a sinusbot user that matches
        let matches = engine.getUsers().filter(user =>
            // does the UID match?
            user.tsUid() == client.uid() ||
            // or does a group ID match?
            client.getServerGroups().map(group => group.id()).includes(user.tsGroupId())
        )

        return matches.some(user => {
            // playback permissions?
            return (user.privileges() & (1 << 12)) != 0
        })
    }
    
    /**
     * Waits.
     * @param {number} ms milliseconds
     * @return {Promise}
     */
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    // /**
    //  * Gets a Message.
    //  * @param {Channel} channel Channel
    //  * @param {string} messageId Message ID
    //  * @return {Promise<DiscordMessage>}
    //  */
    // function getMessage(channel, messageId) {
    //     return new Promise((resolve, reject) => {
    //         // hacky workaround
    //         // @ts-ignore
    //         channel.getMessages({ around: messageId, limit: '1'}, (err, messages) => {
    //             if (err) return reject(err);
    //             if (!messages || messages.length === 0) return reject('Not found.');
    //             if (messages.length !== 1) return reject('Invalid response length.');

    //             setTimeout(() => resolve(messages[0]), 100)
    //         })
    //     })
    // }

    /**
     * Adds a reaction to a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @param {string} emoji Emoji
     * @return {Promise<object>}
     */
    function createReaction(channelID, messageID, emoji) {
        return discord('PUT', `/channels/${channelID}/messages/${messageID}/reactions/${emoji}/@me`, null, false)
    }

    /**
     * Adds a reaction to a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @param {string} userID User ID
     * @param {string} emoji Emoji
     * @return {Promise<object>}
     */
    function deleteUserReaction(channelID, messageID, userID, emoji) {
        return discord('DELETE', `/channels/${channelID}/messages/${messageID}/reactions/${emoji}/${userID}`, null, false)
    }

    /**
     * Executes a discord API call
     * @param {string} method http method
     * @param {string} path path
     * @param {object} [data] json data
     * @param {boolean} [repsonse] `true` if you're expecting a json response, `false otherwise`
     * @return {Promise<object>}
     */
    function discord(method, path, data, repsonse=true) {
        //engine.log(`${method} ${path}`)

        return new Promise((resolve, reject) => {
            backend.extended().rawCommand(method, path, data, (err, data) => {
                if (err) return reject(err)
                if (repsonse) {
                    let res
                    try {
                        res = JSON.parse(data)
                    } catch (err) {
                        return reject(err)
                    }
                    
                    if (res === undefined) {
                        return reject('Invalid Response')
                    }

                    return resolve(res)
                }
                resolve()
            })
        })
    }
})