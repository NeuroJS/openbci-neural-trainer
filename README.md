# OpenBCI Neural Trainer

Node.js app for training a neural network based on OpenBCI experiments

This project is under development, this is just a first draft.

To record data you can use the [OpenBCI Experimenter](https://github.com/NeuroJS/openbci-experimenter) package.

## Setup

* npm install
* Add data recorded by [experimenter](https://github.com/NeuroJS/openbci-experimenter) inside the /data/ folder.

To train the network based on the experiments saved at ./data/*.json

```bash
node trainer exercise
```

To interpret input data based on previously saved neural network state located at ./neural-network/state.json, run:

```bash
node trainer interpret
```

To test input data based on previously saved neural network state located at ./neural-network/state.json, run:

```bash
node trainer test
```

