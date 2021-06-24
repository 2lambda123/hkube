const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { pipelineTypes } = require('@hkube/consts');
const { uid } = require('@hkube/uid');
const { request } = require('./utils');
const validationMessages = require('../lib/consts/validationMessages.js');
const gatewayService = require('../lib/service/gateway');
const pipelines = require('./mocks/pipelines.json');
let restUrl, jobId, config;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        config = global.testParams.config;
    });
    describe('/exec/caching', () => {
        let restPath = null;
        before(async () => {
            restPath = `${restUrl}/exec/caching`;
            const runRawPath = `${restUrl}/exec/raw`;
            const pipeline = pipelines.find((pl) => pl.name === 'flow1');
            const options = {
                uri: runRawPath,
                body: pipeline
            };
            const response = await request(options);
            jobId = response.body.jobId;
        });
        it('should succeed run caching', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'green'
                }
            };
            const response = await request(options);
            expect(response.body).not.to.have.property('error');
            expect(response.body).to.have.property('jobId');
        });
        it('should succeed run caching with debug', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'green',
                    debug: true
                }
            };
            let response = await request(options);
            expect(response.body).not.to.have.property('error');
            expect(response.body).to.have.property('jobId');
            response = await request(options);
            expect(response.body.error.message).eq('debug green-alg-debug already exists');

        });
        it('should fail on no jobId', async () => {
            const options = {
                uri: restPath,
                body: {
                    nodeName: 'black-alg'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should fail on additional property', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black-alg',
                    stam: 'klum'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data should NOT have additional properties (stam)');
        });
        it('should fail on no such node or job', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId: 'stam-job',
                    nodeName: 'stam-alg'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('unable to find pipeline stam-job');
        });
        it('should succeed to execute with right types', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black'
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW, pipelineTypes.NODE]);
        });
        it('should succeed to execute with right flowInputMetadata', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black'
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.flowInputMetadata).to.have.property('metadata');
            expect(res2.body.flowInputMetadata).to.have.property('storageInfo');
        });
        it('should succeed to save the rootJobId', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black'
                }
            };
            await request(options);
            await request(options);
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.rootJobId).to.eql(jobId);
        });
    });
    describe('/exec/raw', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: {}
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: ''
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
        });
        it('should throw validation error of required property nodes', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('pipeline must have at nodes property with at least one node');
        });
        it('should throw validation error of required property nodes.nodeName', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            algorithmName: 'green-alg',
                            input: [{}]
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.eql("data.nodes[0] should have required property 'nodeName'");
        });
        it('should throw validation error of required property nodes.algorithmName', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string'
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain('please provide algorithmName');
        });
        it('should throw validation error of nodes.input should be array', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: null
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
        });
        it('should not throw validation error of data should NOT have additional properties', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    additionalProps: {
                        bla: 60,
                        blabla: 'info'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should throw validation error of duplicate node', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'dup',
                            algorithmName: 'green-alg',
                            input: []
                        },
                        {
                            nodeName: 'dup',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('found duplicate node "dup"');
        });
        it('should throw validation error priority range', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'dup',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    priority: 8
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.priority should be <= 5');
        });
        const invalidStartAndEndChars = ['/', '*', '#', '"', '%'];
        invalidStartAndEndChars.forEach((v) => {
            it(`should throw validation error pipeline name include ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `exec${v}raw`,
                        nodes: [
                            {
                                nodeName: 'string',
                                algorithmName: 'green-alg',
                                input: []
                            }
                        ]
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.PIPELINE_NAME_FORMAT);
            });
            it(`should throw validation error pipeline name start with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `${v}xecraw`,
                        nodes: [
                            {
                                nodeName: 'string',
                                algorithmName: 'green-alg',
                                input: []
                            }
                        ]
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.PIPELINE_NAME_FORMAT);
            });
        });
        it('should throw missing image for algorithm', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'no-image-pipe',
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName: 'eval-alg',
                            input: ['data']
                        },
                        {
                            nodeName: 'yellow',
                            algorithmName: 'no-image-alg',
                            input: ['@green']
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('missing image for algorithm no-image-alg');
        });
        it('should succeed and return job id', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: [],
                            metrics: {
                                tensorboard: true
                            }
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should succeed to run with null flowInput', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: ['@flowInput.inputs']
                        }
                    ],
                    flowInput: {
                        inputs: null
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should succeed to execute with right types', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW]);
        });
    });
    describe('/exec/raw/streaming', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it('should throw invalid node in stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> Z'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('invalid node Z in stream flow analyze');
        });
        it('should throw invalid stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: null
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('invalid stream flow analyze');
        });
        it('should throw not valid flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('stream flow analyze should have valid flow, example: A >> B');
        });
        it('should throw not valid flow format', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A --> B'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('stream flow analyze should have valid flow, example: A >> B');
        });
        it('should throw stream flow only allowed in stream pipeline', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'batch',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: []
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A --> B'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('streaming flow is only allowed in stream pipeline');
        });
        it('should succeed to execute with customStream edge type', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'C',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B >> C'
                        }
                    }
                }
            };
            const re = await request(options);
            const optionsGET = { uri: `${restUrl}/exec/pipelines/${re.body.jobId}`, method: 'GET' };
            const res = await request(optionsGET);
            const flows = Object.keys(res.body.streaming.flows);
            const parsedFlow = Object.keys(res.body.streaming.parsedFlow);
            expect(res.body.edges).to.have.lengthOf(2);
            expect(flows).to.eql(parsedFlow);
            expect(res.body.edges[0].types[0]).to.eql('customStream');
            expect(res.body.edges[1].types[0]).to.eql('customStream');
        });
        it('should succeed to execute with stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'C',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'D',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'E',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze0: 'A >> B >> C >> D >> B >> A',
                            analyze1: 'A >> B&C , C >> D',
                            analyze2: 'A >> B&C >> D',
                            analyze3: 'A >> B >> C >> D >> A',
                            analyze4: 'A >> B&C&D >> E'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('please specify a default stream flow');
        });
        it('should succeed to execute with stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'C',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'D',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'E',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze0: 'A >> B >> C >> D >> B >> A',
                            analyze1: 'A >> B&C , C >> D',
                            analyze2: 'A >> B&C >> D',
                            analyze3: 'A >> B >> C >> D >> A',
                            analyze4: 'A >> B&C&D >> E'
                        },
                        defaultFlow: 'analyze3'
                    }
                }
            };
            const re = await request(options);
            const optionsGET = { uri: `${restUrl}/exec/pipelines/${re.body.jobId}`, method: 'GET' };
            const res = await request(optionsGET);
            const flows = Object.keys(res.body.streaming.flows);
            const parsedFlow = Object.keys(res.body.streaming.parsedFlow);
            expect(res.body.edges).to.have.lengthOf(12);
            expect(flows).to.eql(parsedFlow);
        });
    });
    describe('/streaming/gateways', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it('should throw duplicate gateway nodes', async () => {
            const name = `gate-name-${uid()}`;
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: { name }
                        },
                        {
                            nodeName: 'B',
                            kind: 'gateway',
                            spec: { name }
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain(`gateway ${name}-gateway already exists`);
        });
        it('should insert two gateway nodes', async () => {
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway'
                        },
                        {
                            nodeName: 'B',
                            kind: 'gateway'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body.gateways).to.have.lengthOf(2);
            expect(response.body.gateways[0].nodeName).to.eql(options.body.nodes[0].nodeName);
            expect(response.body.gateways[1].nodeName).to.eql(options.body.nodes[1].nodeName);
        });
        it('should insert gateway with spec', async () => {
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'nodeA',
                            kind: 'gateway',
                            spec: { name: 'gate-name' }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'nodeA >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('gateways');
            expect(response.body.gateways.length).to.eql(1);
            expect(response.body.gateways[0].nodeName).to.eql(options.body.nodes[0].nodeName);
            expect(response.body.gateways[0].url).to.eql(`hkube/gateway/${options.body.nodes[0].spec.name}`);
        });
        it('should insert gateway without spec', async () => {
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway'
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('gateways');
            expect(response.body.gateways.length).to.eql(1);
            expect(response.body.gateways[0].nodeName).to.eql(options.body.nodes[0].nodeName);
            expect(response.body.gateways[0].url).to.contains('hkube/gateway');
        });
        it('should delete gateway by jobId', async () => {
            const gatewayName = uid();
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: { name: gatewayName }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const res = await request(options);
            const res1 = await request({ uri: `${restUrl}/gateway/${gatewayName}`, method: 'GET' });
            expect(res1.body.gatewayName).to.eql(gatewayName);
            await gatewayService.deleteGateways({ jobId: res.body.jobId });
            const res2 = await request({ uri: `${restUrl}/gateway/${gatewayName}`, method: 'GET' });
            expect(res2.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(res2.body.error.message).to.contain(`gateway ${gatewayName} Not Found`);
        });
        it('should insert gateway with full spec', async () => {
            const gateway = uid();
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: {
                                name: gateway,
                                description: 'my gateway',
                                mem: '1Gi'
                            }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const res = await request(options);
            const response = await request({ uri: `${restUrl}/gateway/${gateway}`, method: 'GET' });
            expect(response.body.jobId).to.eql(res.body.jobId);
            expect(response.body.gatewayName).to.eql(gateway);
        });
        it('should get gateway list', async () => {
            const gatewayName = uid();
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: {
                                name: gatewayName,
                                mem: '1Gi'
                            }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            await request(options);
            const response = await request({ uri: `${restUrl}/gateway`, method: 'GET' });
            const gateway = response.body.find((g) => g.gatewayName === gatewayName);
            expect(response.body.length).to.gte(1);
            expect(gateway).to.exist;
        });
    });
});
