pipeline {
    agent {
        docker {
            label 'docker'
            image 'haufelexware/wicked.build-agent:latest'
            // Add docker group
            args '--group-add 999'
        }
    }
    triggers {
        pollSCM "H/10 * * * *"
    }

    environment {
        DOCKER_TAG = env.BRANCH_NAME.replaceAll('/', '-')
    }

    stages {
        // stage('SonarQube analysis') {
        //     steps {
        //         script {
        //             sh 'id'
        //             def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')
        //             if (dockerTag == 'next') {
        //                 // requires SonarQube Scanner 2.8+
        //                 def scannerHome = tool 'wicked-sonar';
        //                 withSonarQubeEnv('sonar') {
        //                     sh "${scannerHome}/bin/sonar-scanner"
        //                 }
        //             } else {
        //                 echo 'Skipping SonarQube, not "next" branch.'
        //             }
        //         }
        //     }
        // }


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
                        sh './src/build.sh'
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