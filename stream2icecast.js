registerPlugin({
    name: 'stream2icecast',
    version: '1.0.1',
    description: 'Streams the bots audio to an icecast server.',
    author: 'SinusBot Team',
    backends: ['ts3', 'discord'],
    vars: [
        // **DO NOT EDIT THIS HERE**
        // Restart the sinusbot, then enable and configure it in the webinterface.
        {
            name: 'streamServer',
            title: 'StreamServer URL',
            type: 'string',
            placeholder: 'http://something.example.com:8000/example'
        },
        {
            name: 'streamUser',
            title: 'User',
            type: 'string'
        },
        {
            name: 'streamPassword',
            title: 'Password',
            type: 'password'
        }
    ]
  }, (_, config, meta) => {
    const engine = require('engine');
    const audio = require('audio');

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`);
  
    if (!config.streamUser) {
        config.streamUser = 'source';
    }
  
    if (config.streamServer && config.streamPassword) {
        audio.streamToServer(config.streamServer, config.streamUser, config.streamPassword);
    } else {
        engine.log('URL or Password missing!');
    }
});