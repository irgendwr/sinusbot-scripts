/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Cleverbot',
    version: '1.0',
    description: 'Talk to cleverbot by using the ask command or in a specified channel.',
    author: 'Jonas Bögle (irgendwr)',
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
            title: 'Minimum Delay (in milliseconds)',
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
            // keeps track of the chat log
            this.chat = []
            // session token thing
            this.XVIS = null
        }

        /**
         * Creates a new session.
         * @param {(error?: string) => void} [callback]
         */
        init(callback) {
            this._send('GET', Cleverbot.base, null, (error, response) => {
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
         * Resets the current state and creates a new session.
         * @param {(error?: string) => void} [callback]
         */
        reset(callback) {
            engine.log('reset')
            this.chat = []
            this.XVIS = null
            this.init(callback)
        }

        /**
         * Ask Cleverbot something.
         * @param {string} input 
         * @param {function} callback 
         * @param {number} retries Take it or leave it.
         */
        ask(input, callback, retries=3) {
            let url = Cleverbot.api
            let body = `stimulus=${Cleverbot._encode(input)}`

            let len = this.chat.length
            for (let i = 0; i < len && i < 7; i++) {
                body += `&vText${i + 2}=${Cleverbot._encode(this.chat[len - i - 1])}`
            }
            this.chat.push(input)
            
            /*
            let lang = Cleverbot._guessLanguage(input);
            if (lang) {
                body += ('&cb_settings_language=' + lang);
            }
            */

            body += '&cb_settings_scripting=no';
            if (this.sessionid) {
                body += `&sessionid=${this.sessionid}`
            }

            body += '&islearning=1&icognoid=wsf&icognocheck=';
            body += helpers.MD5Sum(body.substring(7, 33))
            
            this._send('POST', url, body, (error, response) => {
                if (error) {
                    this.chat.pop()
                    engine.log(`HTTP Error: ${error}`)
                    if (retries <= 0) {
                        if (typeof callback === 'function') callback(error, null)
                        return;
                    } else {
                        engine.log('retry...')
                        return this.ask(input, callback, --retries)
                    }
                }
                
                let res = response.data.toString().split('\r')
                let answer = res[0]
                if (answer == '<HTML><BODY>DENIED</BODY></HTML>') {
                    this.chat.pop()
                    engine.log('Error: Request denied by API')
                    if (typeof callback === 'function') callback('Request denied by API', null)
                    this.reset()
                    return;
                } else if (answer == 'Hello from Cleverbot') {
                    this.reset(error => {
                        if (error) {
                            if (typeof callback === 'function') callback('Invalid response by API', null)
                            return;
                        }
                        engine.log('retry...')
                        this.ask(input, callback, --retries);
                    })
                    return;
                }
                this.chat.push(answer)
                if (this.chat.length > Cleverbot.chatLen) {
                    // remove first two
                    this.chat.splice(0, 2)
                }

                if (!this.sessionid) {
                    this.sessionid = res[1]
                    engine.log(`sessionid: ${this.sessionid}`)
                }

                //engine.log(`answer: ${answer}`)
                if (typeof callback === 'function') callback(null, answer)
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
            //engine.log(url)
            //engine.log(body)

            let cookies = this.XVIS ? `XVIS=${this.XVIS}` : null
            return http.simpleRequest({
                method: method,
                url: url,
                timeout: Cleverbot.defaultTimeout,
                body: body,
                headers: {
                    'Referer': Cleverbot.base,
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
        
        // TODO: either improve or remove
        // /**
        //  * Guess language of given input.
        //  * @private
        //  * @static
        //  * @param {string} input Input
        //  * @return {?string} lang
        //  */
        // static _guessLanguage(input) {
        //     const common = {
        //         de: ["aber", "ach egal", "achso", "aha ich", "alles", "also bist", "also doch", "also wie", "antwort", "auch", "auf", "aus deut", "ausgez", "beantwort", "bei dir", "bei mir", "beides", "bekomm", "beleid", "beschr", "besser", "bestimm", "beweis", "bin ich", "bissch", "bitte", "chatten", "danke", "dann", "darum", "das be", "das bin", "das du", "das freut", "das glaub", "das habe", "das ich", "das ist", "das stimm", "das war", "das weiss", "dein", "deine", "denke", "deswege", "diese", "deutsch", 
        //         "dich", "doch", "ein mann", "ein mensch", "eine frau", "einfach", "entschuld", "erzahl", "es ist", "falsch", "find ich", "findest", "frau", "fresse", "freund", "freut", "ganz", "gar nicht", "geht", "gehst", "gibt", "gibst", "gib mir", "glaub", "gute", "gut und", "genau", "habe", "haben", "hast", "heiss", "heute", "ich auch", "ich bin", "ich hab", "ich hei", "ich wol", "immer", "junge", "kann", "kannst", "kein", "keine", "klar", "liebst", "madchen", "magst", "meine", "mir ist", "nein", 
        //         "nicht", "sagst", "sagte", "schon", "sprech", "sprichst", "tust", "und", "viel", "warum", "was ist", "was mach", "weil", "wenn", "wer ist", "wieder", "wieso", "willst", "wirklich", "woher", "zum"],
        //         en: ["hello", "i am", "am I", "you", "you're", "your", "yourself", "i'm", "i'll", "i'd", "can't", "cannot", "don't", "won't", "would", "wouldn't", "could", "couldn't", "you", "is it", "it's", "it is", "isn't", "there", "their", "goodbye", "good", "bye", "what", "what's", "when", "where", "which", "who", "who's", "why", "how", "think", "the", "they", "them", "that", "this", "that's", "very", "favorite", "favourite", "of", "does", "doesn't", "did", "didn't", "yes", "not", "aren't", "never", "every", 
        //         "everything", "anything", "something", "nothing", "thing", "about", "blush", "blushes", "kiss", "kisses", "down", "look", "looks", "more", "even", "around", "into", "get", "got", "love", "i like", "were", "want", "play", "out", "know", "now", "to be", "live", "living", "friend", "friends", "wish", "with", "marry", "wear", "wearing", "doing", "being", "seeing", "smile", "smiles", "gonna", "wanna", "any", "anyway", "sing", "everyone", "everybody", "always", "nope", "maybe", "i do", "really", "indeed", 
        //         "mean", "course", "fine", "well", "sorry", "exactly", "welcome", "because", "sometimes", "tell", "liar", "true", "wrong", "right", "either", "neither", "giggles", "boy", "girl", "agree", "nevermind", "mind", "intelligence", "software", "guess", "interesting", "said", "meaning", "life", "from", "between", "please", "laughs", "talk", "talking", "old", "my name", "understand", "confuse", "confusing", "speak", "speaking", "joke", "awesome", "today", "alright", "sense", "explain", "need", "have", 
        //         "haven't", "make", "makes", "ask", "asking", "question", "english", "is he", "she", "meet", "lies", "probably", "much", "dunno", "ahead", "boyfriend", "girlfriend", "story", "obviously", "first", "correct"],
        //         es: ["conoces", "crees", "cuando", "donde", "eres", "hablo", "hablas", "pues", "quien", "quiero", "quieres", "sabes", "seguro", "sobre", "aburrido", "acabas", "ademas", "ah vale", "ahora", "alegro", "alguien", "ayer", "bien", "bonito", "comiendo", "como", "conoces", "contigo", "cuando", "cuanto", "dame un", "de nada", "dije", "dijiste", "dimelo", "donde", "encanta", "entonces", "eres", "estamos", "estas", "estoy", "gracias", "gusta", "hablamos", "hacemos", "hola", "hombre", "igual", "interesante", 
        //         "llamas", "llamo", "maquina", "me alegro", "me caes", "mentira", "mi casa", "puedes", "puedo", "pues", "que bueno", "que haces", "que hora", "que pasa", "que tal", "quien", "quieres", "sabes", "seguro", "tambien", "tampoco", "tengo", "tienes", "tu casa", "vamos", "verdad", "vives", "yo soy", "beso", "no se", "espanol", "espa\u00c3\u00b1ol"],
        //         fr: ["oui", "bien", "bien sur", "d'accord", "j'ai", "au revoir", "toi", "moi", "suis", "je ne", "un peu", "connais", "aimes", "savais", "veux", "voudrais", "ca va", "aussi", "pourquoi", "qu'est", "mais", "bonne", "interessant", "francais", "fran\u00c3\u00a7ais", "comprends", "parce que", "bonjour", "combien", "garcon", "fille", "deja", "voila", "desole", "n'est", "m'aime", "m'appelle", "t'aime", "depuis", "toujours", "quelle", "as-tu", "contraire", "revoir", "aucun", "avec", "vous", "alors", 
        //         "bah alors", "bah c'est", "bah je", "maintenant", "moi non", "bah oui", "bah non", "beaucoup", "laisse", "dites", "c'est bien", "amusant", "dommage", "c'est faux", "c'est gentil", "c'est pas", "c'est un", "car tu", "chacun", "comme", "puis", "t'appelles", "comment tu", "donne", "donnes", "toi tu", "il n'y a", "crois", "vais", "tres drol", "aimez", "quand", "tu as", "mieux", "habites", "j'habite", "voulez", "pouvez", "non plus", "manges", "pensez", "je te", "evidemment", "connait", "que fait", 
        //         "j'avais", "embrasse"],
        //         it: ["grazie", "questo", "prego", "sicuro", "quando", "come stai", "arrivederchi", "quanti", "tutti", "per favore", "molte", "di niente", "buongiorno", "buona sera", "scusa", "scusi", "bacio", "perche", "chiami", "chiama", "come ti", "anni hai", "femmina", "maschio", "come va", "ti amo", "va bene", "vabbe", "chi sei", "dove sei", "abiti", "sono", "piacere", "anch'io", "anchio", "anche", "quando", "invece", "dimmi", "te lo", "dico", "che", "e come", "cosa fai", "vivi", "nessuno", "nulla", "infatti", 
        //         "quale", "chi e", "certo", "dimmelo", "quindi", "parlo", "italiano", "con te", "allora", "bello", "benissimo", "piu", "capisco", "conosci", "tutto", "quello", "vuoi", "ragione", "credo", "fidanzata", "a mi", "capito", "sei un", "sei una", "andare", "piaccio"],
        //         nl: ["hoezo", "een", "geen", "uit", "op wie", "hoe is", "niet", "doei", "jawel", "meisje", "waarom", "waar", "nederlands", "mooi", "oud", "ben je", "ik wel", "goed", "jongen", "gaat", "weet", "dankje", "lekker", "woon", "heet", "jij", "leuk", "hou", "hoor", "jou", "tuurlijk", "haat", "daarom", "leuke", "graag", "bedankt", "gewoon", "vind", "schatje", "noem", "klopt", "praten", "praat", "eerst", "mij", "juist", "ik ben", "ben ik"],
        //         da: ["hvordan", "hej"],
        //         pl: ["kochasz", "znasz", "polski", "polska", "zemu", "wiem", "masz", "fajnie", "kocham", "dobre", "dobry", "dobrze", "robisz", "dlaczego", "co tam", "imie", "lubisz", "ja tez", "ja nie", "gdzie", "jestem", "jestes", "czego", "bardzo", "ale co", "powiem", "prawda", "mnie", "ciebie", "znaszy", "co to", "jasne", "w domu", "polsce", "lubie", "co nie", "pisze", "pisz", "polsku", "ty tez", "nieprawda", "normalnie", "nie nie", "masz", "gadaj", "nudze", "bo ty", "wiesz", "muw", "cze\u00c5\u203a\u00c4\u2021"],
        //         pt: ["qual o", "qual e", "quem e", "quem o", "voce e", "voce est", "voce ta", "quer", "quem", "nao", "fala", "falar", "portugues", "portuguesa", "falo port", "tenho", "conhece", "para que", "o que", "meu", "seu", "estou", "isso", "entao", "seu nome", "sim est", "sou", "vou", "tambem", "homem", "mulher", "muito", "bem", "obrigada", "voc\u00c3\u00aa"],
        //         tr: ["merhaba", "nas\u00c4\u00b1ls\u00c4\u00b1n"]
        //     }

        //     for (let lang in common) {
        //         for (let str of common[lang]) {
        //             if (input.includes(str)) {
        //                 //engine.log(`detected lang ${lang} due to string ${str}`)
        //                 return lang
        //             }
        //         }
        //     }
        //     return null
        // }
    }
    Cleverbot.base = 'https://www.cleverbot.com/'
    Cleverbot.api = Cleverbot.base+'webservicemin?uc=UseOfficialCleverbotAPI&'
    Cleverbot.defaultTimeout = 10 * 1000
    Cleverbot.chatLen = 10

    const bot = new Cleverbot()
    const errResponse = 'Sorry, I was unable to process that due to an API error :confused:'

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    event.on('load', () => {
        bot.init()

        const command = require('command')
        if (!command) {
            engine.log('command.js library not found! Please download command.js to your scripts folder and restart the SinusBot, otherwise this script will not work.');
            engine.log('command.js can be found here: https://github.com/Multivit4min/Sinusbot-Command/blob/master/command.js');
            return;
        }
        
        command.createCommand('ask')
        .alias('cleverbot')
        .help('Ask something')
        .manual('Ask something.')
        .addArgument(args => args.rest.setName('message').min(1))
        .exec((client, args, reply, ev) => {
            let start = Date.now()
            typing(ev.channel.id())

            bot.ask(args.message, (err, response) => delay(start, () => {
                if (err) return reply(errResponse);

                reply(response)
                if (tts) audio.say(response)
            }))
        })
    })

    event.on('chat', (/** @type {Message} */ev) => {
        if (ev.channel && ev.channel.id().endsWith(channel)) {
            if (ev.text.startsWith('//') || ev.client.isSelf()) return;
            let start = Date.now()
            typing(ev.channel.id())

            bot.ask(ev.text, (err, response) => delay(start, () => {
                if (err) return ev.channel.chat(errResponse);

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
        if (engine.getBackend() !== 'discord') return;
        if (channelID.includes('/')) channelID = channelID.split('/')[1];
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