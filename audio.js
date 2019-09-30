/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

 registerPlugin({
    name: 'Audio Filter',
    version: '1.0.0',
    description: 'Set audio filters.',
    author: 'Jonas Bögle (irgendwr)',
    backends: ['ts3', 'discord'],
    vars: [
        {
            title: 'Preset',
            name: 'preset',
            type: 'select',
            options: [
                'off (default)',
                'slightly compress',
                'heavy compress (FM Radio)'
            ],
            default: '0'
        },
        {
            title: 'Playback Speed',
            name: 'speed',
            type: 'select',
            options: [
                'normal (default)',
                'slow (0.75)',
                'fast (1.25)',
                'faster (1.5)',
                'fasterer (2.0)'
            ],
            default: '0'
        }
    ]
}, (_, {speed, preset}, meta) => {
    const engine = require('engine')
    const audio = require('audio')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)
    
    var fs = []

    switch (speed) {
    case '1':
        fs.push('atempo=0.75')
        break
    case '2':
        fs.push('atempo=1.25')
        break
    case '3':
        fs.push('atempo=1.5')
        break
    case '4':
        fs.push('atempo=2.0')
        break
    }

    switch (preset) {
    case '1':
        fs.push('compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.2')
        break
    case '2':
        fs.push('volume=-3dB,asplit=5[in1][in2][in3][in4][in5];[in1]lowpass=f=100:p=1,compand=.005|.005:.1|.1:-47/-40|-34/-34|-17/-33[out1];[in2]highpass=f=100:p=1,lowpass=f=400:p=1,compand=.003|.003:.05|.05:-47/-40|-34/-34|-17/-33[out2];[in3]highpass=f=400:p=1,lowpass=f=1600:p=1,compand=.000625|.000625:.0125|.0125:-47/-40|-34/-34|-15/-33[out3];[in4]highpass=f=1600:p=1,lowpass=f=6400:p=1,compand=.0001|.0001:.025|.025:-47/-40|-34/-34|-31/-31|-0/-30[out4];[in5]highpass=f=6400:p=1,compand=.0|.0:.025|.025:-38/-31|-28/-28|-0/-25[out5];[out1][out2][out3][out4][out5]amix=inputs=5,volume=+27dB,volume=-12dB,lowpass=f=17500:p=1,volume=+12dB,volume=-3dB,lowpass=f=17801:p=1')
        break
    }

    if (fs.length === 0) {
        audio.setAudioFilter('')
    } else {
        audio.setAudioFilter('[a]'+fs.join(',')+'[out]')
    }
})