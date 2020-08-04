pipeline {
    agent {
        docker {
            image 'haufelexware/wicked.build-agent:latest'
        }
    }
    triggers {
        pollSCM "H/10 * * * *"
    }

    environment {
        DOCKER_TAG = env.BRANCH_NAME.replaceAll('/', '-')
        DOCKER_PREFIX = 'haufelexware/wicked.'
    }

    stages {
        stage('SonarQube analysis') {
            steps {
                script {
                    sh 'id'
                    def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')
                    def branchSource = dockerTag
                    def branchSourceParam = ''
                    def branchTargetParam = ''
                    if (branchSource == 'master') {
                        // Nothing to do
                    } else if (branchSource == 'next') {
                        branchSourceParam = '-Dsonar.branch.name=next'
                        branchTargetParam = '-Dsonar.branch.target=master'
                    } else {
                        branchSourceParam = '-Dsonar.branch.name=' + branchSource
                        branchTargetParam = '-Dsonar.branch.target=next'
                    }
                    // requires SonarQube Scanner 2.8+
                    def scannerHome = tool 'wicked-sonar';
                    def runSonar = "${scannerHome}/bin/sonar-scanner -X ${branchSourceParam} ${branchTargetParam}"
                    withSonarQubeEnv('wicked-sonar') {
                        // sh "cd ./src/api && ${runSonar}; cd ../.."
                        // sh "cd ./src/auth && ${runSonar}; cd ../.."
                        // sh "cd ./src/chatbot && ${runSonar}; cd ../.."
                        // sh "cd ./src/env && ${runSonar}; cd ../.."
                        // sh "cd ./src/kickstarter && ${runSonar}; cd ../.."
                        // sh "cd ./src/kong-adapter && ${runSonar}; cd ../.."
                        // sh "cd ./src/mailer && ${runSonar}; cd ../.."
                        // sh "cd ./src/node-sdk && ${runSonar}; cd ../.."
                        // sh "cd ./src/ui && ${runSonar}; cd ../.."
                    }
                }
            }
        }

        stage('Build') {
            steps {
                sh './src/build.sh'
            }
        }

        stage('Push') {
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

        stage('API Tests (postgres)') {
            environment {
                BUILD_POSTGRES = 'true';
                BUILD_ALPINE = '';
            }
            steps {
                script {
                    sh './src/test/run-api-tests.sh'
                }
            }
        }

        stage('API Tests (postgres, alpine)') {
            environment {
                BUILD_POSTGRES = 'true';
                BUILD_ALPINE = '-alpine';
            }
            steps {
                script {
                    sh './src/test/run-api-tests.sh'
                }
            }
        }

        // ===========================

        stage('Kong Adapter Tests (postgres)') {
            environment {
                BUILD_ALPINE = ''
                BUILD_POSTGRES = 'true'
            }
            steps {
                script {
                    sh './src/test/run-kong-adapter-tests.sh'
                }
            }
        }

        stage('Kong Adapter Tests (postgres, alpine)') {
            environment {
                BUILD_ALPINE = '-alpine'
                BUILD_POSTGRES = 'true'
            }
            steps {
                script {
                    sh './src/test/run-kong-adapter-tests.sh'
                }
            }
        }

        // ===========================

        stage('Auth Server Tests (postgres)') {
            environment {
                BUILD_ALPINE = ''
                BUILD_POSTGRES = 'true'
            }
            steps {
                script {
                    sh './src/test/run-auth-tests.sh'
                }
            }
        }

        stage('Auth Server Tests (postgres, alpine)') {
            environment {
                BUILD_ALPINE = '-alpine'
                BUILD_POSTGRES = 'true'
            }
            steps {
                script {
                    sh './src/test/run-auth-tests.sh'
                }
            }
        }

        // ===========================

        stage('Wicked-in-a-box') {
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
    }
}


/*
properties([
    pipelineTriggers([
        [$class: "SCMTrigger", scmpoll_spec: "H/10 * * * *"]
    ])
])

node('docker') {
    stage('Checkout') {
        checkout scm
    }

    def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')

    echo 'Building docker tag: ' + dockerTag
    env.DOCKER_TAG = dockerTag
    env.DOCKER_PREFIX = 'haufelexware/wicked.'

    stage('Build and Push') {
        sh './src/build.sh'
    }

    stage('Push') {
        withCredentials([
            usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
        ]) {
            sh './src/push.sh'
        }
    }
}

node('docker') {

    stage('API Tests (postgres)') {
        env.BUILD_POSTGRES = '';
        env.BUILD_POSTGRES = 'true';
        env.BUILD_ALPINE = '';
        sh './src/test/run-api-tests.sh'
    }

    stage('API Tests (postgres, alpine)') {
        env.BUILD_POSTGRES = 'true';
        env.BUILD_ALPINE = '-alpine';
        sh './src/test/run-api-tests.sh'
    }

    // ===========================

    stage('Kong Adapter Tests (postgres)') {
        env.BUILD_ALPINE = ''
        env.BUILD_POSTGRES = 'true'
        sh './src/test/run-kong-adapter-tests.sh'
    }

    stage('Kong Adapter Tests (postgres, alpine)') {
        env.BUILD_ALPINE = '-alpine'
        env.BUILD_POSTGRES = 'true'
        sh './src/test/run-kong-adapter-tests.sh'
    }

    // ===========================

    stage('Auth Server Tests (postgres)') {
        env.BUILD_ALPINE = ''
        env.BUILD_POSTGRES = 'true'
        sh './src/test/run-auth-tests.sh'
    }

    stage('Auth Server Tests (postgres, alpine)') {
        env.BUILD_ALPINE = '-alpine'
        env.BUILD_POSTGRES = 'true'
        sh './src/test/run-auth-tests.sh'
    }

    // ===========================

    stage('Build wicked.box') {
        echo 'Here be dragons.'
    }
}
*/