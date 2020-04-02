/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Rename EVERYONE',
    version: '1.0.0',
    description: 'Allows you to rename everyone in your discord server.',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['discord'],
    //requiredModules: ['discord-dangerous'],
    vars: [
        {
            name: 'guild',
            title: 'Guild ID',
            type: 'string',
        },
        {
            name: 'name',
            title: 'Name',
            type: 'string',
        },
        {
            name: "admins",
            title: "UIDs of users which have access to admin commands",
            type: "strings",
            default: []
        },
        {
            name: 'delay',
            title: 'Delay (should normally be 30 seconds due to rate limiting)',
            type: 'number',
            default: 30,
            placeholder: 30,
        },
        {
            name: 'invert',
            title: 'Invert List',
            type: 'checkbox',
            default: false,
        },
        {
            name: 'join',
            title: 'Rename on join',
            type: 'checkbox',
            default: false,
        },
    ]
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const store = require('store')

    if (!config.guild) {
        engine.log('Please set the guild ID in the config.');
        return;
    }
    /*if (!config.name) {
        engine.log('Please set the name in the config.');
        return;
    }*/

    // see https://discordapp.com/developers/docs/topics/gateway#rate-limiting
    const DELAY = (config.delay || 30) * 1000;

    let stop = false;
    let previousName;
    let previousNicks = store.getInstance('previousNicks') || [];

    event.on('load', () => {
        const command = require('command')
        if (!command) {
            engine.log('command.js library not found! Please download command.js to your scripts folder and restart the SinusBot, otherwise this script will not work.');
            engine.log('command.js can be found here: https://github.com/Multivit4min/Sinusbot-Command/blob/master/command.js');
            return;
        }

        command.createCommand('rename-everyone')
        .alias('RE')
        .addArgument(command.createArgument('rest').setName('name').optional())
        .help('Rename everyone')
        .manual('Renames everyone.')
        .checkPermission(allowAdminCommands)
        .exec((client, args, reply, ev) => {
            if (args.name && args.name !== '') {
                previousName = config.name;
                config.name = args.name;
                //engine.saveConfig(config);
            }

            engine.log(`renaming everyone to ${config.name}...`)
            reply(`${config.name}? Sounds good!\nPlease wait, this may take very *very* long...`)
            
            stop = false;
            renameEveryone(config.name).then(() => {
                engine.log(`done`)
                engine.log(`${previousNicks.length} entries stored`);
                reply(`Done! ${previousNicks.length} entries stored, see log for more.`);
            })
        })

        command.createCommand('rename-everyone-clear')
        .alias('RE-clear')
        .help('Rename everyone')
        .manual('Renames everyone.')
        .checkPermission(allowAdminCommands)
        .exec((client, args, reply, ev) => {
            stop = true;
            previousName = config.name;
            config.name = "";
            config.join = false;
            //engine.saveConfig(config);

            engine.log(`clearing everyones nickname...`)
            reply(`Clearing everyones nickname.\nPlease wait, this may take very *very* long...`)
            
            stop = false;
            renameEveryone(config.name).then(() => {
                engine.log(`done`)
                reply(`Done!`);
            })
        })
        
        command.createCommand('rename-everyone-stop')
        .alias('RE-stop')
        .help('Stop renaming everyone')
        .manual('Stops renaming everyone.')
        .checkPermission(allowAdminCommands)
        .exec((client, args, reply, ev) => {
            if (stop) {
                return reply('Stopped already.')
            }

            stop = true;
            reply('okay')
        })

        command.createCommand('rename-everyone-previous')
        .alias('RE-previous')
        .help('Log previous nichnames')
        .manual('Logs previous nichnames.')
        .checkPermission(allowAdminCommands)
        .exec((client, args, reply, ev) => {
            engine.log(`${previousNicks.length} entries found`);
            engine.log(JSON.stringify(previousNicks));
            reply(`${previousNicks.length} entries found, see log for more`);
        })

        command.createCommand('rename-everyone-previous-rm')
        .alias('RE-previous-rm')
        .help('Remove previous nichnames')
        .manual('Removes previous nichnames.')
        .checkPermission(allowAdminCommands)
        .exec((client, args, reply, ev) => {
            previousNicks = [];
            store.unsetInstance('previousNicks');
            reply('done');
        })
    })

    if (config.join) {
        // NOTE: I don't know why, but these don't work :(
        
        event.on('discord:GUILD_MEMBERADD', member => {
            engine.log(`processing member: ${member.user.username} ${member.nick ? `(${member.nick})` : ''}`);
            processMember(member, config.nick);
        });

        event.on('clientMove', ev => {
            let id = ev.client.uid().split('/');
            if (id[0] != config.guild) return;

            getMember(config.guild, id[1]).then(member => {
                engine.log(`processing member: ${member.user.username} ${member.nick ? `(${member.nick})` : ''}`);
                processMember(member, config.nick)
            });
        });
        event.on('clientVisible', ev => {
            let id = ev.client.uid().split('/');
            if (id[0] != config.guild) return;

            getMember(config.guild, id[1]).then(member => {
                engine.log(`processing member: ${member.user.username} ${member.nick ? `(${member.nick})` : ''}`);
                processMember(member, config.nick)
            });
        });
        event.on('chat', ev => {
            let id = ev.client.uid().split('/');
            if (id[0] != config.guild) return;

            getMember(config.guild, id[1]).then(member => {
                if (processMember(member, config.nick)) {
                    engine.log(`renamed member: ${member.user.username} ${member.nick ? `(${member.nick})` : ''}`);
                }
            });
        });
    }

    /**
     * Rename everyone.
     * @param {string} nick Nickname
     */
    async function renameEveryone(nick) {
        let last = 0;
        while (!stop && last >= 0) {
            last = await getMembers(config.guild, 1000, last).then(members => processMemberList(members, nick))
            engine.log(`last: ${last}`)
        }

        store.setInstance('previousNicks', previousNicks);
    }

    /**
     * Process a member list.
     * @param {object[]} members see https://discordapp.com/developers/docs/resources/guild#guild-member-object
     * @param {string} nick Nickname
     */
    async function processMemberList(members, nick) {
        engine.log(`processing ${members.length} members...`)

        // sort ASC by join date
        members.sort(function(a, b) {
            var joined_atA = a.joined_at.toUpperCase();
            var joined_atB = b.joined_at.toUpperCase();
            if (joined_atA < joined_atB) {
              return -1;
            }
            if (joined_atA > joined_atB) {
              return 1;
            }
          
            // joined_at must be equal
            return 0;
        });

        if (config.invert) {
            engine.log('inverting array')
            members.reverse();
        }

        if (members.length === 0) {
            return -1;
        }
        
        let highestID = 0;
        for (let member of members) {
            if (stop) {
                engine.log('Stopping.')
                return -2;
            }

            //engine.log(`member: ${JSON.stringify(member)}`);
            //engine.log(`processing member: ${member.user.username} ${member.nick ? `(${member.nick})` : ''}`);
            let renamed = processMember(member, nick);

            if (member.user.id > highestID) highestID = member.user.id;

            if (renamed) {
                engine.log(`renamed member: ${member.user.username} ${member.nick ? `(${member.nick})` : ''}`);
                await wait(DELAY);
            }
        }

        return highestID;
    }

    /**
     * Process a member. Set nick, if it doesn't match.
     * @param {object} member see https://discordapp.com/developers/docs/resources/guild#guild-member-object
     * @param {string} nick Nickname
     * @returns {boolean} if member was renamed
     */
    function processMember(member, nick) {
        if (member.nick && member.nick == nick) {
            return false;
        }

        if (member.nick && member.nick !== previousName) {
            previousNicks.push({
                id: member.user.id,
                nick: member.nick,
                username: member.user.username,
                discriminator: member.user.discriminator,
            });
        }

        setNick(config.guild, member.user.id, nick).catch(err => engine.log(err));

        return true;
    }

    /**
     * Wait until resolving promise.
     * @param {number} delay Delay in ms
     * @param {any} [value] Value passed to resolve
     */
    function wait(delay, value) { 
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(value);
            }, delay);
        });
    }

    /**
     * Gets a user object.
     * @param {(string|number)} guildID Guild ID
     * @param {(string|number)} userID User ID
     * @param {string} nick Nickname
     * @return {Promise<object>}
     */
    function setNick(guildID, userID, nick) {
        return discord('PATCH', `/guilds/${guildID}/members/${userID}`, {nick: nick}, false)
    }

    /**
     * Returns a list of guild member objects that are members of the guild.
     * @param {(string|number)} guildID Guild ID
     * @param {number} [limit] Max number of members to return (1-1000)
     * @param {(string|number)} [after] Highest user id in the previous page
     * @return {Promise<object>}
     * @author Jonas Bögle
     * @license MIT
     */
    function getMembers(guildID, limit=1, after=0) {
        return discord('GET', `/guilds/${guildID}/members?limit=${limit}&after=${after}`, null, true)
    }

    /**
     * Returns a list of guild member objects that are members of the guild.
     * @param {(string|number)} guildID Guild ID
     * @param {(string|number)} userID User ID
     * @return {Promise<object>}
     * @author Jonas Bögle
     * @license MIT
     */
    function getMember(guildID, userID) {
        return discord('GET', `/guilds/${guildID}/members/${userID}`, null, true)
    }

    /**
     * Executes a discord API call
     * @param {string} method http method
     * @param {string} path path
     * @param {object} [data] json data
     * @param {boolean} [repsonse] `true` if you're expecting a json response, `false` otherwise
     * @return {Promise<object>}
     * @author Jonas Bögle
     * @license MIT
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
                        engine.log(`${method} ${path} failed`)
                        engine.log(`${data}`)
                        return reject(err)
                    }
                    
                    if (res === undefined) {
                        engine.log(`${method} ${path} failed`)
                        engine.log(`${data}`)
                        return reject('Invalid Response')
                    }

                    return resolve(res)
                }
                resolve()
            })
        })
    }

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
})