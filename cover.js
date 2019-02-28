/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Cover',
    version: '1.0.0',
    description: 'Automatically attempts to download a cover image.',
    author: 'Jonas Bögle (irgendwr)',
    backends: ['ts3', 'discord'],
    requiredModules: ['http'],
    vars: []
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const http = require('http')
    const media = require('media')

    const userAgent = `SinusBot${meta.name}Script/${meta.version} ( https://github.com/irgendwr/sinusbot-scripts )`

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    var invalids = [];
    
    event.on('track', (/** @type {Track} */ track) => {
        if (track.thumbnail()) {
            engine.log('skipping: track already has a thumbnail');
            return;
        }
        if (invalids.includes(track.id())) {
            engine.log('skipping: previously marked as invalid (reload to clear)');
            return;
        }
        if (track.type() !== '' && track.type() !== 'file') {
            engine.log('skipping: invalid file type');
            return;
        }

        let title = track.title()
        let artist = track.artist()
        let album = track.album()

        if (artist && album) {
            engine.log(`Searching for release thumbnail (${artist} - ${album})...`);

            http.simpleRequest({
                method: 'GET',
                url: `https://musicbrainz.org/ws/2/release/?query="${luceneEscape(album)}"%20AND%20artist:"${luceneEscape(artist)}`,
                timeout: 6000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': userAgent
                }
            }, (error, response) => {
                if (error) return engine.log("Error: " + error)
                if (response.statusCode != 200) return engine.log("HTTP Error: " + response.status);
                
                // parse JSON response
                let {releases} = JSON.parse(response.data.toString())
                
                if (releases.length !== 0) {
                    setThumbnail(track, releases[0].id)
                } else {
                    engine.log('no results found, marking as invalid');
                    invalid(track)
                }
            })
        } else if (title && artist) {
            engine.log(`Searching for recording thumbnail (${artist} - ${title})...`);

            http.simpleRequest({
                method: 'GET',
                url: `https://musicbrainz.org/ws/2/recording/?query="${luceneEscape(title)}"%20AND%20artist:"${luceneEscape(artist)}"%20AND%20dur:[${track.duration()-10000}%20TO%20${track.duration()+10000}]`,
                timeout: 6000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': userAgent
                }
            }, (error, response) => {
                if (error) return engine.log("Error: " + error)
                if (response.statusCode != 200) return engine.log("HTTP Error: " + response.status);
                
                // parse JSON response
                let {recordings} = JSON.parse(response.data.toString())
                
                if (recordings.length !== 0 && recordings[0].releases.length !== 0) {
                    setThumbnail(track, recordings[0].releases[0].id)
                } else {
                    engine.log('no results found, marking as invalid');
                    invalid(track)
                }
            })
        } else {
            engine.log('not enough info: you need to set artist and (title or album), marking as invalid');
            invalid(track)
        }
    })

    /**
     * Sets a tracks thumbnail.
     * @param {Track} track
     * @param {string} mbid
     */
    function setThumbnail(track, mbid) {
        //engine.log('mbid: '+mbid);

        http.simpleRequest({
            method: 'GET',
            url: `https://coverartarchive.org/release/${mbid}/`,
            timeout: 6000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': userAgent
            }
        }, (err, response) => {
            if (err) return engine.log("Error: " + err)
            if (response.statusCode != 200) return engine.log("HTTP Error (cover): " + response.status);

            let {images} = JSON.parse(response.data.toString())

            if (images && images.length !== 0) {
                engine.log('success: '+images[0].thumbnails.large);
                track.setThumbnailFromURL(images[0].thumbnails.large)
                //engine.log('success!');
            } else {
                engine.log('no image found, marking as invalid');
                invalid(track)
            }
        });
    }

    /**
     * Marks a track as invalid
     * @param {Track} track
     */
    function invalid(track) {
        invalids.push(track.id());
    }

    /**
     * Escape lucene string
     * @see https://lucene.apache.org/core/4_3_0/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
     * @param {string} str
     * @return {string}
     */
    function luceneEscape(str) {
        str = str.replace(/[+\-!(){}[\]^"~*?:\\/]|&&|\|\|/gm, "\\$&")
        return encodeURIComponent(str)
    }

    event.on('load', () => {
        // @ts-ignore
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')

        command.createCommand('setthumbnail')
        .help('Set thumbnail of currently playing track')
        .manual('Set thumbnail of currently playing track')
        .checkPermission(hasEditFilePermission)
        .addArgument(command.createArgument('rest').setName('url').min(1))
        .exec((client, args, reply) => {
            let track = media.getCurrentTrack()

            if (!track) {
                reply('no track playing')
                return;
            }
            
            track.setThumbnailFromURL(args.url)
        })
    })

    /**
     * Checks if a client has the necessary permissons
     * @param {Client} client
     * @returns {boolean} true if client has permission
     * @requires engine
     */
    function hasEditFilePermission(client) {
        // try to find a sinusbot user that matches
        let matches = engine.getUsers().filter(user =>
            // does the UID match?
            user.tsUid() == client.uid() ||
            // or does a group ID match?
            client.getServerGroups().map(group => group.id()).includes(user.tsGroupId())
        )

        return matches.some(user => {
            // edit file permissions?
            return (user.privileges() & (1 << 4)) != 0
        })
    }
})