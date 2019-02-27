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
                let album = track.album()
                let duration = track.duration()

                let fields = []
                if (duration) {
                    fields.push({
                        name: "Duration",
                        value: timestamp(duration),
                        inline: true
                    })
                }
                if (album) {
                    fields.push({
                        name: "Album",
                        value: album,
                        inline: true
                    })
                }

                // @ts-ignore
                backend.extended().createMessage(ev.channel.id(), {
                    embed: {
                        title: artist ? `${artist} - ${title}` : title,
                        url: url || '#',
                        color: 0xe13438,
                        footer: {
                          icon_url: "https://sinusbot.github.io/logo.png",
                          text: "SinusBot"
                        },
                        thumbnail: {
                            url: url && track.thumbnail() ? `${url}/cache/${track.thumbnail()}` : null
                        },
                        fields: fields
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
})