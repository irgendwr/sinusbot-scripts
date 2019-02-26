/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Show playing Song in Discord',
    version: '1.0.0',
    description: 'Shows the playing Song in Discord and adds rich-embedd to playing command.',
    author: 'Jonas Bögle <jonas@boegle.me>',
    engine: '>= 1.0.0',
    backends: ['discord'],
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

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    event.on('load', () => {
        // @ts-ignore
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')
        
        command.createCommand('playing')
        .help('Show what\'s currantly playing')
        .manual('Show what\'s currantly playing')
        .exec((client, args, reply, ev) => {
            if (audio.isPlaying()) {
                let track = media.getCurrentTrack();
                let title = track.tempTitle() || track.title()
                let artist = track.tempArtist() || track.artist()

                // @ts-ignore
                backend.extended().createMessage(ev.channel.id().split('/')[1], {
                    embed: {
                        title: artist ? `${artist} - ${title}` : title,
                        color: 0xe13438,
                        thumbnail: {
                            url: url && track.thumbnail() ? `${url}/cache/${track.thumbnail()}` : null
                        },
                        author: {
                            name: 'SinusBot',
                            url: url,
                            icon_url: 'https://sinusbot.github.io/logo.png',
                        }
                    }
                })
            }
        })
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
    }
})