var glob = require("glob");
var path = require('path');
var argv = require('yargs').argv;
var async = require('async');
var brain = require('brain');
var jsonfile = require('jsonfile');
var OpenBCIBoard = require('openbci-sdk');

var randomExperiment;
var trainedNetwork;
var channelsToFilter = []; // Add channels to filter. Eg.: ['2','4']
var networkStateFilePath = path.join(__dirname, '/neural-network/state.json');
var experimentFilesPath = path.join(__dirname, '/data/*.json');
var action = argv._[0] || null;

// OpenBCI
const board = new OpenBCIBoard.OpenBCIBoard();

/**
 * Read experiments and invoke @interpret
 * @type {Array}
 */
glob(experimentFilesPath, (error, experimentFiles) => {
    experimentFiles = experimentFiles
        .map((experimentFile) => {
            return async.apply(jsonfile.readFile, experimentFile)
        });
    async.parallel(experimentFiles, (error, experiments) => {
        if (error) return console.log('failed to load experiments');
        if (action === 'exercise') {
            var patterns = getPatternsFromExperiments(experiments);
            console.log('patterns:', patterns);
            exercise(patterns);
        }
        if (action === 'test') {
            var testData = getRandomPatternFromExperiments(experiments);
            test(testData.input);
        }
        if (action === 'interpret') {
            jsonfile.readFile(networkStateFilePath, (error, networkState) => {
                trainedNetwork = new brain.NeuralNetwork().fromJSON(networkState);
                board.autoFindOpenBCIBoard()
                    .then(onBoardFind);
            });

        }
    });
});

// Board find handler
function onBoardFind (portName) {
    if (portName) {
        console.log('board found', portName);
        board.connect(portName)
            .then(onBoardConnect);
    }
}

// Board connect handler
function onBoardConnect () {
    board.on('ready', onBoardReady);
}

// Board ready handler
function onBoardReady () {
    board.streamStart();
    board.on('sample', interpret);
    setTimeout(disconnectBoard, argv._[2]);
}

/**
 * getRandomPatternFromExperiments
 * @param experiments
 */
function getRandomPatternFromExperiments (experiments) {
    randomExperiment = experiments[Math.floor(Math.random() * experiments.length)];
    var randomPattern = randomExperiment.patterns[Math.floor(Math.random() * randomExperiment.patterns.length)];
    return filterChannelsFromPatterns([randomPattern], channelsToFilter)[0];
}

/**
 * exercise
 * @param patterns
 */
function exercise (patterns) {
    console.log('training...', patterns);
    var net = new brain.NeuralNetwork({
        hiddenLayers: [8, 8, 8],
        learningRate: 0.6
    });
    net.train(patterns, {
        errorThresh: 0.005,
        iterations: 5000,
        learningRate: 0.6,
        log: true,
        logPeriod: 10
    });
    var trainingState = net.toJSON();
    jsonfile.writeFileSync(networkStateFilePath, trainingState);
    console.log('training completed. neural network state located at ' + networkStateFilePath);
}

/**
 * test
 * @param input
 */
function test (input) {
    jsonfile.readFile(networkStateFilePath, (error, networkState) => {
        var net = new brain.NeuralNetwork().fromJSON(networkState);
        console.log('interpreting...', input);
        var output = net.run(input);
        getTestResults(output);
    });
}

/**
 * interpret
 * @param sample
 */
function interpret (sample) {
    var output = {};
    sample.channelData.forEach((channel, index) => {
        output['' + (index + 1)] = channel;
    });
    var result = trainedNetwork.run(output);
    console.log('most accurate:', getMostAccurate(result).keyword);
}

/**
 * getPatternsFromExperiments: Parses patterns the way brain.js is expecting it
 */
function getPatternsFromExperiments(experiments) {
    var patterns = [];
    experiments.forEach((experiment) => {
        patterns = patterns.concat(experiment.patterns);
    });
    return filterChannelsFromPatterns(patterns, channelsToFilter);
}

/**
 * filterChannelsFromPatterns
 * @param patterns
 * @param channels
 */
function filterChannelsFromPatterns (patterns, channels) {
    patterns.forEach((pattern) => {
        Object.keys(pattern.input).forEach((channel) => {
            // Make all numbers positive
            pattern.input[channel] = Math.abs(pattern.input[channel]);
            if (channels.indexOf(channel) !== -1) {
                delete pattern.input[channel];
            }
        });
    });
    return patterns;
}

/**
 * getMostAccurate
 * @param output
 */
function getMostAccurate (output) {
    var result = {};
    var scores = [];
    var mostAccurate;
    Object.keys(output).forEach((keyword) => {
        scores.push(output[keyword]);
    });
    mostAccurate = Math.max.apply(Math, scores);
    Object.keys(output).forEach((keyword) => {
        if (output[keyword] === mostAccurate) {
            result = {
                keyword: keyword,
                accuracy: output[keyword]
            }
        }
    });
    return result;
}

/**
 * getTestResults
 * @param output
 */
function getTestResults (output) {
    var mostAccurate = getMostAccurate(output, randomExperiment);
    console.log('random experiment selected: ' + randomExperiment.name);
    console.log('most accurate output was ' + mostAccurate.keyword + ' with ' + mostAccurate.accuracy + ' accuracy');
    if (mostAccurate.keyword === randomExperiment.name) {
        console.log('TEST PASSED');
    } else {
        console.log('output', output);
        console.log('TEST FAILED');
    }
}

/**
 * disconnectBoard
 */
function disconnectBoard () {
    board.streamStop()
        .then(function () {
            setTimeout(function () {
                board.disconnect();
                console.log('board disconnected');
            }, 50);
        });
}