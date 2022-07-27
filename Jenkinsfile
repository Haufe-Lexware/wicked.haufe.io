pipeline {
    // agent {
    //     docker {
    //         image 'haufelexware/wicked.build-agent:latest'
    //     }
    // }
    agent {
        label 'linux'
    }

    triggers {
        pollSCM "H/10 * * * *"
    }

    environment {
        DOCKER_TAG = env.BRANCH_NAME.replaceAll('/', '-')
        DOCKER_PREFIX = 'haufelexware/wicked.'
    }

    stages {
        // stage('SonarQube analysis') {
        //     steps {
        //         script {
        //             sh 'id'
        //             def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')
        //             def branchSource = dockerTag
        //             def branchSourceParam = ''
        //             def branchTargetParam = ''
        //             if (branchSource == 'master') {
        //                 // Nothing to do
        //             } else if (branchSource == 'next') {
        //                 branchSourceParam = '-Dsonar.branch.name=next'
        //                 branchTargetParam = '-Dsonar.branch.target=master'
        //             } else {
        //                 branchSourceParam = '-Dsonar.branch.name=' + branchSource
        //                 branchTargetParam = '-Dsonar.branch.target=next'
        //             }
        //             // requires SonarQube Scanner 2.8+
        //             def scannerHome = tool 'wicked-sonar';
        //             def runSonar = "${scannerHome}/bin/sonar-scanner -X ${branchSourceParam} ${branchTargetParam}"
        //             withSonarQubeEnv('wicked-sonar') {
        //                 // sh "cd ./src/api && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/auth && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/chatbot && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/env && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/kickstarter && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/kong-adapter && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/mailer && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/node-sdk && ${runSonar}; cd ../.."
        //                 // sh "cd ./src/ui && ${runSonar}; cd ../.."
        //             }
        //         }
        //     }
        // }

        stage('Build (x64)') {
            environment {
                DOCKER_DEFAULT_PLATFORM = 'linux/amd64'
            }
            steps {
                sh './src/build.sh'
            }
        }

        stage('Push (x64)') {
            environment {
                DOCKER_DEFAULT_PLATFORM = 'linux/amd64'
            }
            steps {
                script {
                    withCredentials([
                        usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
                    ]) {
                        sh './src/push.sh'
                    }
                }
            }
        }

        stage('Build (ARM)') {
            environment {
                DOCKER_DEFAULT_PLATFORM = 'linux/arm64'
            }
            steps {
                sh './src/build.sh'
            }
        }

        stage('Push (ARM)') {
            environment {
                DOCKER_DEFAULT_PLATFORM = 'linux/arm64'
            }
            steps {
                script {
                    withCredentials([
                        usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
                    ]) {
                        sh './src/push.sh'
                    }
                }
            }
        }

        // ===========================

        stage('Wicked-in-a-box (x64)') {
            environment {
                DOCKER_DEFAULT_PLATFORM = 'linux/amd64'
            }
            steps {
                script {
                    withCredentials([
                        usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
                    ]) {
                        sh './src/box/build.sh ' + env.BRANCH_NAME + ' --push'
                    }
                }
            }
        }

        stage('Wicked-in-a-box (ARM)') {
            environment {
                DOCKER_DEFAULT_PLATFORM = 'linux/arm64'
            }
            steps {
                script {
                    withCredentials([
                        usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
                    ]) {
                        sh './src/box/build.sh ' + env.BRANCH_NAME + ' --push'
                    }
                }
            }
        }

        // ===========================

        stage('API Tests (postgres, alpine)') {
            environment {
                BUILD_POSTGRES = 'true';
                BUILD_ALPINE = '-alpine';
                DOCKER_DEFAULT_PLATFORM = 'linux/amd64'
            }
            steps {
                script {
                    sh './src/test/run-api-tests.sh'
                }
            }
        }

        stage('API Tests (ARM)') {
            environment {
                BUILD_POSTGRES = 'true';
                BUILD_ALPINE = '-alpine';
                DOCKER_DEFAULT_PLATFORM = 'linux/arm64'
            }
            steps {
                script {
                    sh './src/test/run-api-tests.sh'
                }
            }
        }

        // ===========================

        stage('Kong Adapter Tests (x64)') {
            environment {
                BUILD_ALPINE = '-alpine'
                BUILD_POSTGRES = 'true'
                DOCKER_DEFAULT_PLATFORM = 'linux/amd64'
            }
            steps {
                script {
                    sh './src/test/run-kong-adapter-tests.sh'
                }
            }
        }

        stage('Kong Adapter Tests (ARM)') {
            environment {
                BUILD_ALPINE = '-alpine'
                BUILD_POSTGRES = 'true'
                DOCKER_DEFAULT_PLATFORM = 'linux/arm64'
            }
            steps {
                script {
                    sh './src/test/run-kong-adapter-tests.sh'
                }
            }
        }

        // ===========================

        stage('Auth Server Tests (x64)') {
            environment {
                BUILD_ALPINE = '-alpine'
                BUILD_POSTGRES = 'true'
                DOCKER_DEFAULT_PLATFORM = 'linux/amd64'
            }
            steps {
                script {
                    sh './src/test/run-auth-tests.sh'
                }
            }
        }

        stage('Auth Server Tests (ARM)') {
            environment {
                BUILD_ALPINE = '-alpine'
                BUILD_POSTGRES = 'true'
                DOCKER_DEFAULT_PLATFORM = 'linux/arm64'
            }
            steps {
                script {
                    sh './src/test/run-auth-tests.sh'
                }
            }
        }

        // ===========================

        stage('Multi-Arch Manifests') {
            steps {
                script {
                    withCredentials([
                        usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
                    ]) {
                        sh './src/ci-manifest.sh ' + env.BRANCH_NAME
                    }
                }
            }
        }
    }
}
