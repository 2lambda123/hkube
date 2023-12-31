const { expect } = require('chai');
const { jobTemplate } = require('../lib/templates/algorithm-builder');
const { settings } = require('../lib/helpers/settings');
let config, createBuildJobSpec, applyName;

describe('jobCreator', () => {
    before(() => {
        config = global.testParams.config;
        ({ createBuildJobSpec, applyName } = require('../lib/jobs/algorithm-builds'));
    });
    beforeEach(() => {
        settings.applyResourceLimits = false;
    });
    it('should replace image name in spec', () => {
        const res = applyName(jobTemplate, 'myAlgo1');
        expect(res).to.nested.include({ 'metadata.name': 'build-myAlgo1' });
    });
    it('should throw if no algorithm name', () => {
        expect(() => createBuildJobSpec({ version: 'v1.2' })).to.throw('Unable to create job spec. buildId is required');
    });
    it('should apply all required properties', () => {
        const buildId = 'my-alg-12345'
        const res = createBuildJobSpec({
            buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            }, options: config
        });
        expect(res).to.nested.include({ 'metadata.name': 'build-' + buildId });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-builder:v1.2' });
        expect(res).to.nested.include({ 'metadata.labels.build-id': buildId });
        expect(res).to.nested.include({ 'metadata.labels.type': 'algorithm-builder' });
    });
    it('should add kaniko if needed', () => {
        settings.applyResourceLimits = true;
        settings.resourcesMain = {
            memory: 256,
            cpu: 0.1
        }
        settings.resourcesBuilder = {
            memory: 300,
            cpu: 0.2
        }
        const buildId = 'my-alg-12345'
        const options = {
            ...config,
            buildMode: 'kaniko'
        }

        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'kaniko', tag: 'v1.1.0'
                    }]
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[1].resources.limits).to.eql({ cpu: 0.4, memory: "600Mi" });
        expect(res.spec.template.spec.containers[0].resources.requests).to.eql({ cpu: 0.1, memory: "256Mi" });

    });
    it('should add openshift if needed', () => {
        settings.applyResourceLimits = true;
        settings.resourcesMain = {
            memory: 256,
            cpu: 0.1
        }
        settings.resourcesBuilder = {
            memory: 300,
            cpu: 0.2
        }
        const buildId = 'my-alg-12345'
        const options = {
            ...config,
            buildMode: 'openshift'
        }

        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'oc-builder', tag: 'v1.1.0'
                    }]
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('oc-builder');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/oc-builder:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[1].resources.limits).to.eql({ cpu: 0.4, memory: "600Mi" });
        expect(res.spec.template.spec.containers[0].resources.requests).to.eql({ cpu: 0.1, memory: "256Mi" });

    });
    it('should add kaniko if needed without resources', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...config,
            buildMode: 'kaniko'
        }
        const resourcesMain = {
            memory: 256,
            cpu: 0.1
        }
        const resourcesBuilder = {
            memory: 300,
            cpu: 0.2
        }
        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'kaniko', tag: 'v1.1.0'
                    }]
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
            resourcesBuilder,
            resourcesMain,
            algorithmBuilderResourcesEnable: false
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[1].resources).to.not.exist;

    });
    it('should add kaniko if needed with registry', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...config,
            buildMode: 'kaniko'
        }
        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'kaniko', tag: 'v1.1.0'
                    }]
            },
            options,
            registry: {
                registry: 'my-reg:5000'
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            }
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('my-reg:5000/hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
    });
    it('should not add kaniko if not needed', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...config,
            buildMode: 'docker'
        }
        const res = createBuildJobSpec({
            buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            }, options
        });
        expect(res.spec.template.spec.containers).to.be.of.length(1);
        expect(res.spec.template.spec.containers[0].securityContext.privileged).to.be.true;
    });
    it('should add imagePullSecret', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...config,
            buildMode: 'docker'
        }
        const res = createBuildJobSpec({
            buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
            clusterOptions: { imagePullSecretName: 'my-secret' }
        });
        expect(res.spec.template.spec.imagePullSecrets).to.exist;
        expect(res.spec.template.spec.imagePullSecrets[0]).to.eql({ name: 'my-secret' });
    });
    describe('sidecars', () => {
        before(() => {
            settings.sidecars = [{
                name: 'my-sidecar',
                container: [
                    { name: 'c1', image: 'foo/bar' },
                    { name: 'c2', image: 'foo/bar' }
                ],
                volumes: [
                    {
                        name: "v1",
                        emptyDir: {}
                    },
                    {
                        name: "v2",
                        configMap: {
                            name: "cm2"
                        }
                    }
                ],
                volumeMounts: [
                    {
                        name: "v2",
                        mountPath: '/tmp/foo'
                    }

                ],
                environments: [
                    {
                        name: "env1",
                        value: "val1"
                    },
                    {
                        name: "env2",
                        value: "val2"
                    }
                ]

            }]
        })
        after(() => {
            settings.sidecars = []
        });
        it('should not apply sidecar if not enabled', () => {
            const buildId = 'my-alg-12345'
            const res = createBuildJobSpec({
                buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                    metadata: {
                        name: 'test'
                    },
                    data: {

                    }
                }, options: config
            });
            expect(res.spec.template.spec.containers).to.have.lengthOf(2)
        });
        it('should apply sidecar if enabled', () => {
            const buildId = 'my-alg-12345'
            const res = createBuildJobSpec({
                buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                    metadata: {
                        name: 'test'
                    },
                    data: {

                    }
                },
                options: config,
                clusterOptions: { "my-sidecarSidecarEnabled": true }
            });
            
            expect(res.spec.template.spec.containers).to.have.lengthOf(4)
            expect(res.spec.template.spec.containers[2].name).to.eql('c1')
            expect(res.spec.template.spec.containers[3].name).to.eql('c2')
            expect(res.spec.template.spec.volumes).to.deep.include(settings.sidecars[0].volumes[0])
            expect(res.spec.template.spec.volumes).to.deep.include(settings.sidecars[0].volumes[1])
            expect(res.spec.template.spec.containers[0].volumeMounts).to.deep.include(settings.sidecars[0].volumeMounts[0])
            expect(res.spec.template.spec.containers[1].volumeMounts).to.not.deep.include(settings.sidecars[0].volumeMounts[0])
            expect(res.spec.template.spec.containers[0].env).to.deep.include(settings.sidecars[0].environments[0])
            expect(res.spec.template.spec.containers[0].env).to.deep.include(settings.sidecars[0].environments[1])
            expect(res.spec.template.spec.containers[1].env).to.not.exist;
        });
        it('should not apply sidecar if no sidecar configmap', () => {
            const buildId = 'my-alg-12345'
            const res = createBuildJobSpec({
                buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                    metadata: {
                        name: 'test'
                    },
                    data: {

                    }
                },
                options: config,
                clusterOptions: { "no-sidecarSidecarEnabled": true }
            });
            expect(res.spec.template.spec.containers).to.have.lengthOf(2)
        });
    })
});
