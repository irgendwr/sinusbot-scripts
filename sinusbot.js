registerPlugin({
    name: 'SinusBot Commands',
    version: '1.0.0',
    description: 'Enables the default commands.',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['ts3', 'discord'],
    requiredModules: ['discord-dangerous'],
    vars: [
        {
            name: 'url',
            title: 'URL to Webinterface (optional, for album covers in discord)',
            type: 'string',
            placeholder: 'i.e. https://sinusbot.example.com'
        },
        {
            name: 'deleteOldMessages',
            title: 'Delete previous responses if !playing command is used again',
            type: 'checkbox',
            default: true
        },
    ]
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const format = require('format')
    const audio = require('audio')
    const media = require('media')
    const store = require('store')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    /********* privileges *********/
    /* eslint-disable no-unused-vars */
    const LOGIN           = 1 <<  0;
    const LIST_FILE       = 1 <<  1;
    const UPLOAD_FILE     = 1 <<  2;
    const DELETE_FILE     = 1 <<  3;
    const EDIT_FILE       = 1 <<  4;
    const CREATE_PLAYLIST = 1 <<  5;
    const DELETE_PLAYLIST = 1 <<  6;
    const ADDTO_PLAYLIST  = 1 <<  7;
    const STARTSTOP       = 1 <<  8;
    const EDITUSERS       = 1 <<  9;
    const CHANGENICK      = 1 << 10;
    const BROADCAST       = 1 << 11;
    const PLAYBACK        = 1 << 12;
    const ENQUEUE         = 1 << 13;
    const ENQUEUENEXT     = 1 << 14;
    const EDITBOT         = 1 << 15;
    const EDITINSTANCE    = 1 << 16;
    /* eslint-enable no-unused-vars */

    const ERROR_PREFIX = '❌ ';
    const WARNING_PREFIX = '⚠ ';
    const SUCCESS_PREFIX = '✔ ';
    const USAGE_PREFIX = ERROR_PREFIX + 'Usage: ';

    const url = config.url;
    const REACTION_PREV = '⏮';
    const REACTION_PLAYPAUSE = '⏯';
    const REACTION_NEXT = '⏭';

    // restore lastEmbeds
    /** @type {object[]} */
    let lastEmbeds = store.get('lastEmbeds') || [];

    event.on('load', () => {
        const command = require('command');
        if (!command) {
            engine.log('command.js library not found! Please download command.js and enable it to be able use this script!');
            return;
        }
        
        command.createCommand('register')
        .addArgument(command.createArgument('string').setName('username'))
        .help('Register a new user')
        .manual('Registers a new user bound to the Account you are using. This account has no privileges by default but can be edited by the bot administrators.')
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // TODO: check if registration is enabled.
            /*
            if (!engine.registrationEnabled()) {
                return;
            }
            */

            // print syntax if no username given
            if (!args.username) {
                reply(USAGE_PREFIX + 'register <username>');
                return;
            }

            if (engine.getUserByName(args.username)) {
                reply(ERROR_PREFIX + 'This username already exists.');
                return;
            }

            // check if client already has a user
            let user = getUserByUid(client.uid());
            if (user) {
                reply(ERROR_PREFIX + `You already have a user with the name "${user.name()}".`);
                return;
            }

            // create user
            let newUser = engine.addUser(args.username);
            if (!newUser) {
                reply(ERROR_PREFIX + 'Unable to create user, try another username.');
                return;
            }
            // set uid
            newUser.setTSUid(client.uid());
        });
        
        command.createCommand('password')
        .addArgument(command.createArgument('string').setName('value'))
        .help('Change your password to <value>')
        .manual('Changes your password to <value>.')
        .checkPermission(client => {
            return getUserByUid(client.uid()) != null;
        })
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no value given
            if (!args.value) {
                reply(USAGE_PREFIX + 'password <value>\n'+ WARNING_PREFIX + 'Don\'t use this command in a public channel.');
                return;
            }

            if (ev.mode !== 1) {
                reply(WARNING_PREFIX + 'Don\'t use this command in a public channel.');
                return;
            }

            let user = getUserByUid(client.uid());
            if (!user) {
                reply(ERROR_PREFIX + `You don't have a user-account. Use ${format.bold('!register')} to create one.`);
                return;
            }

            // set password
            user.setPassword(args.value);
            reply(SUCCESS_PREFIX + 'Changed your password.');
        });

        if (engine.getBackend() == 'discord') {
            command.createCommand('playing')
            .help('Show what\'s currantly playing')
            .manual('Show what\'s currantly playing')
            .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
                if (!audio.isPlaying()) {
                    return reply('There is nothing playing at the moment.');
                }

                backend.extended().createMessage(ev.channel.id(), getPlayingEmbed(), (err, res) => {
                    if (err) return engine.log(err);
                    if (!res) return engine.log('Error: empty response');

                    const {id, channel_id} = JSON.parse(res);

                    // messages that should be deleted
                    let deleteMsg = [];
                    const msgId = ev.message ? ev.message.ID() : null;
                    const index = lastEmbeds.findIndex(embed => embed.channelId == channel_id);
                    if (index !== -1) {
                        if (config.deleteOldMessages) {
                            // delete previous embed
                            deleteMsg.push(lastEmbeds[index].messageId);
                            // delete previous command from user
                            if (lastEmbeds[index].messageId) {
                                deleteMsg.push(lastEmbeds[index].invokeMessageId);
                            }
                        }
                        // save new embed
                        lastEmbeds[index].messageId = id;
                        lastEmbeds[index].invokeMessageId = msgId;
                    } else {
                        // save new embed
                        lastEmbeds.push({
                            channelId: channel_id,
                            messageId: id,
                            invokeMessageId: msgId
                        });
                    }

                    deleteMessages(channel_id, deleteMsg);
                    
                    wait(1000)
                    // create reaction controls
                    .then(() => createReaction(channel_id, id, REACTION_PREV))
                    .then(() => wait(150))
                    .then(() => createReaction(channel_id, id, REACTION_PLAYPAUSE))
                    .then(() => wait(150))
                    .then(() => createReaction(channel_id, id, REACTION_NEXT));
                });
            });
        } else {
            command.createCommand('playing')
            .help('Show what\'s currantly playing')
            .manual('Show what\'s currantly playing')
            // eslint-disable-next-line no-unused-vars
            .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
                if (!audio.isPlaying()) {
                    return reply('There is nothing playing at the moment.');
                }

                reply(formatTrack(media.getCurrentTrack()));
            });
        }

        command.createCommand('next')
        .help('Play the next track')
        .manual('Plays the next track (only when a playlist or queue is active).')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            media.playNext();
        });

        command.createCommand('prev')
        .help('Play the previous track')
        .manual('Plays the previous track (only when a playlistis active).')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            media.playPrevious();
        });

        command.createCommand('search')
        .addArgument(command.createArgument('string').setName('searchstring'))
        .help('Search for tracks')
        .manual('Searches for tracks, returns 20 results at most.')
        .checkPermission(requirePrivileges(PLAYBACK, ENQUEUE))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no searchstring given
            if (!args.searchstring) {
                reply(USAGE_PREFIX + 'search <searchstring>');
                return;
            }

            const tracks = media.search(args.searchstring);
            if (tracks.length == 0) {
                reply('Sorry, nothing found.');
                return;
            }

            const response = tracks.map(formatTrackWithID).join("\n")
            reply(response);
        });

        command.createCommand('play')
        .addArgument(command.createArgument('string').setName('idORsearchstring'))
        .help('Play a track by its id or name')
        .manual('Plays a track by its id or searches for a track and plays the first match.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no idORsearchstring given
            if (!args.idORsearchstring) {
                reply(USAGE_PREFIX + 'play <searchstring / uuid>');
                return;
            }

            let track = media.getTrackByID(args.idORsearchstring);
            if (!track) {
                const tracks = media.search(args.searchstring);
                if (tracks.length > 0) {
                    track = tracks[0];
                } else {
                    reply('Sorry, nothing found.');
                    return;
                }
            }

            track.play();
            reply(`Playing ${formatTrack(track)}`);
        });

        command.createCommand('queue')
        .addArgument(command.createArgument('string').setName('idORsearchstring').optional(true))
        .help('Enqueue a track or resume queue.')
        .manual('Enqueue a track by its id or search for a track and enqueue the first match. When no track is provided it wil resume the queue.')
        .checkPermission(requirePrivileges(PLAYBACK, ENQUEUE))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            if (!args.idORsearchstring) {
                //TODO: media.playQueueNext();
                return;
            }

            let track = media.getTrackByID(args.idORsearchstring);
            if (!track) {
                const tracks = media.search(args.searchstring);
                if (tracks.length > 0) {
                    track = tracks[0];
                } else {
                    reply('Sorry, nothing found.');
                    return;
                }
            }

            track.enqueue();
            reply(`Added ${formatTrack(track)} to the queue`);
        });

        command.createCommand('queuenext')
        .addArgument(command.createArgument('string').setName('idORsearchstring'))
        .help('Prepends a track to the queue.')
        .manual('Prepends a track by its id or searches for a track and prepends the first match to the queue.')
        .checkPermission(requirePrivileges(ENQUEUENEXT))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no idORsearchstring given
            if (!args.idORsearchstring) {
                reply(USAGE_PREFIX + 'queuenext <searchstring / uuid>');
                return;
            }

            let track = media.getTrackByID(args.idORsearchstring);
            if (!track) {
                const tracks = media.search(args.searchstring);
                if (tracks.length > 0) {
                    track = tracks[0];
                } else {
                    reply('Sorry, nothing found.');
                    return;
                }
            }

            track.enqueue();
            reply(`Added ${formatTrack(track)} to the queue`);
        });

        command.createCommand('stop')
        .help('Stop playback')
        .manual('Stops playback.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            media.stop();
        });

        command.createCommand('stop')
        .forcePrefix(engine.getCommandPrefix() + '!') // => <prefix>!stop
        .help('Stop playback and remove idle-track')
        .manual('Stops playback and removes idle-track.')
        .checkPermission(requirePrivileges(PLAYBACK|EDITBOT))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            media.stop();

            //TODO: media.clearIdleTrack()
        });

        command.createCommand('volume')
        .addArgument(command.createArgument('string').setName('value'))
        .help('Stop playback and remove idle-track')
        .manual('Stops playback and removes idle-track.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            let value = args.value;
            let volume = audio.getVolume();

            switch (value) {
            case "up":
                volume += 10;
                break;
            case "down":
                volume -= 10;
                break;
            default:
                value = parseInt(value, 10);
                if (value >= 0 && value <= 100) {
                    volume = value;
                } else {
                    reply(USAGE_PREFIX + 'volume <up|down|0-100>');
                    return;
                }
            }
            
            if (volume < 0) {
                volume = 0;
            } else if (volume > 100) {
                volume = 100;
            }

            audio.setVolume(volume);
        });

        command.createCommand('stream')
        .addArgument(command.createArgument('string').setName('url'))
        .help('Stream a url')
        .manual('Streams from <url>; this may be http-streams like shoutcast / icecast or just remote soundfiles.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.url) {
                reply(USAGE_PREFIX + 'stream <url>');
                return;
            }

            if (!media.ytStream(args.url)) {
                reply(ERROR_PREFIX + 'Invalid URL.');
            }
        });

        command.createCommand('say')
        .addArgument(command.createArgument('string').setName('text'))
        .help('Say a text via TTS')
        .manual('Uses text-to-speech (if configured) to say the given text.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.text) {
                reply(USAGE_PREFIX + 'say <text>');
                return;
            }

            audio.say(args.text);
        });

        command.createCommand('yt')
        .addArgument(command.createArgument('string').setName('url'))
        .help('Play <url> via youtube-dl')
        .manual('Plays <url> via external youtube-dl (if enabled); beware: the file will be downloaded first and played back afterwards, so there might be a slight delay before playback starts.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.url) {
                reply(USAGE_PREFIX + 'yt <url>');
                return;
            }

            if (!media.yt(args.url)) {
                reply(ERROR_PREFIX + 'Invalid URL.');
            }
        });

        command.createCommand('ytdl')
        .addArgument(command.createArgument('string').setName('url'))
        .help('Play <url> via youtube-dl')
        .manual('Plays <url> via external youtube-dl (if enabled); beware: the file will be downloaded first and played back afterwards, so there might be a slight delay before playback starts; additionally, the file will be stored.')
        .checkPermission(requirePrivileges(PLAYBACK|UPLOAD_FILE))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.url) {
                reply(USAGE_PREFIX + 'ytdl <url>');
                return;
            }

            if (!media.ytdl(args.url, true)) {
                reply(ERROR_PREFIX + 'Invalid URL.');
            }
        });

        command.createCommand('qyt')
        .addArgument(command.createArgument('string').setName('url'))
        .help('Enqueue <url> via youtube-dl')
        .manual('Enqueues <url> via external youtube-dl (if enabled); beware: the file will be downloaded first and played back afterwards, so there might be a slight delay before playback starts.')
        .checkPermission(requirePrivileges(PLAYBACK, ENQUEUE))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.url) {
                reply(USAGE_PREFIX + 'qyt <url>');
                return;
            }

            if (!media.enqueueYt(args.url)) {
                reply(ERROR_PREFIX + 'Invalid URL.');
            }
        });

        command.createCommand('qytdl')
        .addArgument(command.createArgument('string').setName('url'))
        .help('Enqueue <url> via youtube-dl')
        .manual('Enqueues <url> via external youtube-dl (if enabled); beware: the file will be downloaded first and played back afterwards, so there might be a slight delay before playback starts; additionally, the file will be stored.')
        .checkPermission(requirePrivileges(PLAYBACK|UPLOAD_FILE, ENQUEUE|UPLOAD_FILE))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.url) {
                reply(USAGE_PREFIX + 'qytdl <url>');
                return;
            }

            if (!media.enqueueYtdl(args.url)) {
                reply(ERROR_PREFIX + 'Invalid URL.');
            }
        });

        command.createCommand('shuffle')
        .help('Toggle shuffle')
        .manual('Toggles shuffle.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            audio.setShuffle(!audio.isShuffle());
        });

        command.createCommand('repeat')
        .help('Toggle repeat')
        .manual('Toggles repeat.')
        .checkPermission(requirePrivileges(PLAYBACK))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            audio.setRepeat(!audio.isRepeat());
        });

        command.createCommand('registration')
        .addArgument(command.createArgument('string').setName('value'))
        .help('Change command prefix')
        .manual('Changes the prefix for all core commands to <new prefix>, default is "!".')
        .checkPermission(requirePrivileges(EDITBOT))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            switch (args.value) {
            case "enable":
                engine.enableRegistration();
                break;
            case "disable":
                engine.disableRegistration();
                break;
            default:
                // TODO: show if it's enabled or not
                reply(/*`Registartion is currently ${engine.registrationEnabled() ? 'en' : 'dis'}abled\n` +*/ USAGE_PREFIX + 'registration <enable|disable>');
            }
        });

        command.createCommand('prefix')
        .addArgument(command.createArgument('string').setName('prefix'))
        .help('Change command prefix')
        .manual('Changes the prefix for all core commands to <new prefix>, default is "!".')
        .checkPermission(requirePrivileges(EDITBOT))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            // print syntax if no url given
            if (!args.prefix) {
                reply(USAGE_PREFIX + 'prefix <new prefix>');
                return;
            }

            engine.setCommandPrefix(args.prefix);
            reply(SUCCESS_PREFIX + 'New prefix: ' + args.prefix);
        });

        command.createCommand('version')
        .help('Show version')
        .manual('Shows the SinusBot version.')
        .checkPermission(requirePrivileges(EDITBOT))
        // eslint-disable-next-line no-unused-vars
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(message: string)=>void} */reply, /** @implements {Message} */ev) => {
            reply(`SinusBot v${engine.version()}\ncommand.js v${command.getVersion()}`);
        });
    });

    /********** !playing stuff for discord **********/
    if (engine.getBackend() == 'discord') {
        event.on('unload', () => {
            // save lastEmbeds
            store.set('lastEmbeds', lastEmbeds);
        });

        event.on('discord:MESSAGE_REACTION_ADD', ev => {
            const emoji = (ev.emoji.id || '') + ev.emoji.name;

            // ignore reactions that are not controls
            if (![REACTION_PREV, REACTION_PLAYPAUSE, REACTION_NEXT].includes(emoji)) return;
            // ignore reactions from the bot itself
            if (backend.getBotClientID().endsWith(ev.user_id)) return;

            // get user via id
            const client = backend.getClientByID((ev.guild_id ? ev.guild_id+'/' : '')+ev.user_id);
            // check if user was found
            if (client) {
                // ignore reactions from the bot itself
                if (client.isSelf()) return;
                // check if user has the 'playback' permission
                if (requirePrivileges(PLAYBACK)(client)) {
                    const track = media.getCurrentTrack();

                    switch (emoji) {
                    case REACTION_PREV:
                        // ignore if nothing is playing
                        if (!audio.isPlaying()) return;

                        if (media.getQueue().length !== 0) {
                            // start from beginning if we're playing queue
                            audio.seek(0);
                        } else {
                            // try prev (doesn't work for queue or folder)
                            media.playPrevious();
        
                            // fallback: start from beginning if there is no previous track
                            if (!audio.isPlaying()) {
                                if (track) track.play();
                            }
                        }
                        break
                    case REACTION_PLAYPAUSE:
                        if (audio.isPlaying()) {
                            media.stop();
                        } else {
                            if (!track) return;

                            const pos = audio.getTrackPosition()
                            if (pos && pos < track.duration()) {
                                // continue playing at last pos
                                audio.setMute(true);
                                track.play();
                                audio.seek(pos);
                                audio.setMute(false);
                            } else {
                                // or start from beginning if it already ended
                                track.play();
                            }
                        }
                        break
                    case REACTION_NEXT:
                        // ignore if nothing is playing
                        if (!audio.isPlaying()) return;
                            
                        media.playNext();
                    }
                } else {
                    engine.log(`${client.nick()} is missing playback permissions for reaction controls`);
                    client.chat(ERROR_PREFIX + 'You need the playback permission to use reaction controls');
                }
            }
            // delete the rection
            deleteUserReaction(ev.channel_id, ev.message_id, ev.user_id, emoji);
        });

        /**
         * Called when track or it's info changes
         * @param {Track} track
         */
        const onChange = track => {
            const prefix = '🎵 ';
            const postfix = ' 🎵';

            // set track info as status
            backend.extended().setStatus({
                game: {
                    name: prefix + formatTrack(track) + postfix,
                    type: 2, // => 0 (game), 1 (streaming), 2 (listening)
                },
                status: "online",
                afk: false
            });

            // update embeds
            lastEmbeds.forEach(async embed => {
                await editMessage(embed.channelId, embed.messageId, getPlayingEmbed()).then(() => wait(100))
            });
        };

        event.on('track', onChange);
        event.on('trackInfo', onChange);
        event.on('trackEnd', () => {
            backend.getBotClient().setDescription('');
        });
    }

    /**
     * Returns embed for current track
     */
    function getPlayingEmbed() {
        let track = media.getCurrentTrack();
        let album = track.album();
        let duration = track.duration();

        let fields = [];
        fields.push({
            name: "Duration",
            value: duration ? timestamp(duration) : 'stream',
            inline: true
        });
        if (album) {
            fields.push({
                name: "Album",
                value: album,
                inline: true
            });
        }

        return {
            embed: {
                title: formatTrack(track),
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


    /********** helper functions **********/

    /**
     * Returns the first user with a given UID.
     *
     * @param {string} uid UID of the client
     * @returns {User} first user with given uid
     */
    function getUserByUid(uid) {
        for (let user of engine.getUsers()) {
            if (user.tsUid() == uid) {
                return user;
            }
        }

        return null;
    }

    /**
     * Returns alls users that match the clients UID and ServerGroups.
     *
     * @param {Client} client
     * @returns {User[]} Users that match the clients UID and ServerGroups.
     */
    function getUsersByClient(client) {
        return engine.getUsers().filter(user =>
            // does the UID match?
            client.uid() == user.tsUid() ||
            // does a group ID match?
            client.getServerGroups().map(group => group.id()).includes(user.tsGroupId())
        );
    }

    /**
     * Returns a function that checks if a given user has all of the required privileges.
     * @param {...number} privileges If at least one privilege matches the returned function will return true.
     */
    function requirePrivileges() {
        // get arguments as array
        let privileges = Array.from(arguments);
        // return a function that checks the permissions
        return (/** @type {Client} */ client) => {
            // check if at least one user has the required privileges
            return getUsersByClient(client).some(user => {
                // check if at least one privilege is found
                return privileges.some(priv => {
                    return (user.privileges() & priv) === priv;
                });
            });
        };
    }

    /**
     * Returns a formatted string from a track.
     *
     * @param {Track} track
     * @returns {string} formatted string
     */
    function formatTrackWithID(track) {
        return `${format.code(track.id())} ${formatTrack(track)}`;
    }

    /**
     * Returns a formatted string from a track.
     *
     * @param {Track} track
     * @returns {string} formatted string
     */
    function formatTrack(track) {
        let title = track.tempTitle() || track.title();
        let artist = track.tempArtist() || track.artist();
        return artist ? `${artist} - ${title}` : title;
    }

    /**
     * Returns a more human readable timestamp (hours:minutes:secods)
     * @param {number} milliseconds
     */
    function timestamp(milliseconds) {
        const SECOND = 1000;
        const MINUTE = 60 * SECOND;
        const HOUR = 60 * MINUTE;

        let seconds = Math.floor(milliseconds / SECOND);
        let minutes = Math.floor(milliseconds / MINUTE);
        let hours = Math.floor(milliseconds / HOUR);
        
        minutes = minutes % (HOUR/MINUTE);
        seconds = seconds % (MINUTE/SECOND);

        let str = '';

        if (hours !== 0) {
            str += hours + ':';
            if (minutes <= 9) {
                str += '0';
            }
        }
        str += minutes + ':';
        if (seconds <= 9) {
            str += '0';
        }
        str += seconds;

        return str;
    }
    
    /**
     * Waits for given milliseconds.
     * @param {number} ms Time to wait for in milliseconds.
     * @return {Promise}
     */
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Adds a reaction to a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @param {string} emoji Emoji
     * @return {Promise<object>}
     */
    function createReaction(channelID, messageID, emoji) {
        return discord('PUT', `/channels/${channelID}/messages/${messageID}/reactions/${emoji}/@me`, null, false);
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
        return discord('DELETE', `/channels/${channelID}/messages/${messageID}/reactions/${emoji}/${userID}`, null, false);
    }

    /**
     * Edits a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @param {object} message New message
     * @return {Promise<object>}
     */
    function editMessage(channelID, messageID, message) {
        return discord('PATCH', `/channels/${channelID}/messages/${messageID}`, message, true);
    }

    /**
     * Deletes a message.
     * @param {string} channelID Channel ID
     * @param {string} messageID Message ID
     * @return {Promise<object>}
     */
    function deleteMessage(channelID, messageID) {
        return discord('DELETE', `/channels/${channelID}/messages/${messageID}`, null, false);
    }

    /**
     * Deletes multiple messages.
     * @param {string} channelID Channel ID
     * @param {string[]} messageIDs Message IDs
     * @return {Promise<object>}
     */
    function deleteMessages(channelID, messageIDs) {
        switch (messageIDs.length) {
            case 0: return Promise.resolve();
            case 1: return deleteMessage(channelID, messageIDs[0]);
            default: return discord('POST', `/channels/${channelID}/messages/bulk-delete`, {messages: messageIDs}, false);
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
        return new Promise((resolve, reject) => {
            backend.extended().rawCommand(method, path, data, (err, data) => {
                if (err) return reject(err);
                if (repsonse) {
                    let res;
                    try {
                        res = JSON.parse(data);
                    } catch (err) {
                        return reject(err);
                    }
                    
                    if (res === undefined) {
                        return reject('Invalid Response');
                    }

                    return resolve(res);
                }
                resolve();
            });
        });
    }
})