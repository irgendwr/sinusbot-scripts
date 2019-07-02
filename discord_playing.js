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
            name: 'url',
            title: 'URL to Webinterface (optional, for album covers)',
            type: 'string',
            placeholder: 'i.e. https://sinusbot.example.com'
        },
        {
            name: 'deleteOldMessages',
            title: 'Delete previous responses if command is used again',
            type: 'checkbox',
            default: true
        },
    ]
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const audio = require('audio')
    const media = require('media')
    const store = require('store')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    const url = config.url;
    const PREV = '⏮'
    const PLAYPAUSE = '⏯'
    const NEXT = '⏭'

    // restore lastEmbeds
    /** @type {object[]} */
    let lastEmbeds = store.get('lastEmbeds') || [];

    event.on('load', () => {
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')
        
        command.createCommand('playing')
        .help('Show what\'s currantly playing')
        .manual('Show what\'s currantly playing')
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            if (!audio.isPlaying()) {
                return reply('There is nothing playing at the moment.')
            }

            backend.extended().createMessage(ev.channel.id(), getPlayingEmbed(), (err, res) => {
                if (err) return engine.log(err)
                if (!res) return engine.log('Error: empty response')

                const {id, channel_id, embeds} = JSON.parse(res)

                // messages that should be deleted
                let deleteMsg = []
                const msgId = ev.message ? ev.message.ID() : 0
                const index = lastEmbeds.findIndex(embed => embed.channelId == channel_id)
                if (index !== -1) {
                    if (config.deleteOldMessages) {
                        // delete previous embed
                        deleteMsg.push(lastEmbeds[index].messageId)
                        // delete previous command from user
                        if (lastEmbeds[index].messageId) {
                            deleteMsg.push(lastEmbeds[index].invokeMessageId)
                        }
                    }
                    // save new embed
                    lastEmbeds[index].messageId = id
                    lastEmbeds[index].invokeMessageId = msgId
                } else {
                    // save new embed
                    lastEmbeds.push({
                        channelId: channel_id,
                        messageId: id,
                        invokeMessageId: msgId
                    })
                }

                ev.channel.getMessages({ around: id, limit: '2' }, (err, msgs) => {
                    if (err || embeds.length !== 1) return;
                    msgs.forEach(msg => {
                        // delete "old" message from sinusbot
                        if (msg.content() == embeds[0].title) {
                            deleteMsg.push(msg.ID())
                        }
                    })

                    // delete messages
                    deleteMessages(channel_id, deleteMsg)
                })

                wait(1000)
                // create reaction controls
                .then(() => createReaction(channel_id, id, PREV))
                .then(() => wait(150))
                .then(() => createReaction(channel_id, id, PLAYPAUSE))
                .then(() => wait(150))
                .then(() => createReaction(channel_id, id, NEXT))
            })
        })
    })

    event.on('unload', () => {
        // save lastEmbeds
        store.set('lastEmbeds', lastEmbeds)
    })

    event.on('discord:MESSAGE_REACTION_ADD', ev => {
        const emoji = (ev.emoji.id || '') + ev.emoji.name

        // ignore reactions that are not controls
        if (![PREV, PLAYPAUSE, NEXT].includes(emoji)) return;
        // ignore reactions from the bot itself
        if (backend.getBotClientID().endsWith(ev.user_id)) return;

        // get user via id
        const client = backend.getClientByID((ev.guild_id ? ev.guild_id+'/' : '')+ev.user_id)
        // check if user was found
        if (client) {
            // ignore reactions from the bot itself
            if (client.isSelf()) return;
            // check if user has the 'playback' permission
            if (hasPlaybackPermission(client)) {
                const track = media.getCurrentTrack()

                switch (emoji) {
                case PREV:
                    // ignore if nothing is playing
                    if (!audio.isPlaying()) return;

                    if (media.getQueue().length !== 0) {
                        // start from beginning if we're playing queue
                        audio.seek(0)
                    } else {
                        // try prev (doesn't work for queue or folder)
                        media.playPrevious()
    
                        // fallback: start from beginning if there is no previous track
                        if (!audio.isPlaying()) {
                            if (track) track.play()
                        }
                    }
                    break
                case PLAYPAUSE:
                    if (audio.isPlaying()) {
                        media.stop()
                    } else {
                        if (!track) return;

                        const pos = audio.getTrackPosition()
                        if (pos && pos < track.duration()) {
                            // continue playing at last pos
                            audio.setMute(true)
                            track.play()
                            audio.seek(pos)
                            audio.setMute(false)
                        } else {
                            // or start from beginning if it already ended
                            track.play()
                        }
                    }
                    break
                case NEXT:
                    // ignore if nothing is playing
                    if (!audio.isPlaying()) return;
                        
                    media.playNext()
                }
            } else {
                engine.log(`${client.nick()} is missing playback permissions for reaction controls`)
                client.chat('🚫 You need the playback permission to use reaction controls')
            }
        }
        // delete the rection
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

        // let str = text.replace(/%t/gi, title)
        // .replace(/%a/gi, artist)
        // .replace(/%s/gi, artist ? `${artist} - ${title}` : title)

        // set track info as status
        backend.extended().setStatus({
            game: {
                name: artist ? `${artist} - ${title}` : title,
                type: 2, // => 0 (game), 1 (streaming), 2 (listening)
            },
            status: "online",
            afk: false
        })

        // update embeds
        lastEmbeds.forEach(async embed => {
            await editMessage(embed.channelId, embed.messageId, getPlayingEmbed()).then(() => wait(100))
        })
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
                footer: {
                    icon_url: "https://sinusbot.github.io/logo.png",
                    text: "SinusBot"
                }
            }
        };
    }

    /**
     * Returns a more human readable timestamp (hours:minutes:secods)
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
     * Checks if a client has the playback permisson.
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
     * Waits for given milliseconds.
     * @param {number} ms Time to wait for in milliseconds.
     * @return {Promise}
     */
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

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
     * Removes a reaction from a message.
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
     * Edits a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @param {object} message New message
     * @return {Promise<object>}
     */
    function editMessage(channelID, messageID, message) {
        return discord('PATCH', `/channels/${channelID}/messages/${messageID}`, message, true)
    }

    /**
     * Deletes a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @return {Promise<object>}
     */
    function deleteMessage(channelID, messageID) {
        return discord('DELETE', `/channels/${channelID}/messages/${messageID}`, null, false)
    }

    /**
     * Deletes multiple messages.
     * @param {string} channelID Channel ID
     * @param {string[]} messageIDs Message IDs
     * @return {Promise<object>}
     */
    function deleteMessages(channelID, messageIDs) {
        switch (messageIDs.length) {
            case 0: return Promise.resolve()
            case 1: return deleteMessage(channelID, messageIDs[0])
            default: return discord('POST', `/channels/${channelID}/messages/bulk-delete`, {messages: messageIDs}, false)
        }
    }

    /**
     * Executes a discord API call
     * @param {string} method http method
     * @param {string} path path
     * @param {object} [data] json data
     * @param {boolean} [repsonse] `true` if you're expecting a json response, `false` otherwise
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