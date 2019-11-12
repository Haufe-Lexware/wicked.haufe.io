// pipeline {
//     agent {
//         docker {
//             image 'haufelexware/wicked.build-agent:latest'
//             // Add docker group
//             args '--group-add 999'
//         }
//     }
//     triggers {
//         pollSCM "H/10 * * * *"
//         upstream(upstreamProjects: "wicked.env/" + env.BRANCH_NAME.replaceAll("/", "%2F"), threshold: hudson.model.Result.SUCCESS)
//     }

//     stages {
//         stage('SonarQube analysis') {
//             steps {
//                 script {
//                     sh 'id'
//                     def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')
//                     if (dockerTag == 'next') {
//                         // requires SonarQube Scanner 2.8+
//                         def scannerHome = tool 'wicked-sonar';
//                         withSonarQubeEnv('sonar') {
//                             sh "${scannerHome}/bin/sonar-scanner"
//                         }
//                     } else {
//                         echo 'Skipping SonarQube, not "next" branch.'
//                     }
//                 }
//             }
//         }

//         stage('Build and Push') {
//             steps {
//                 script {
//                     withCredentials([
//                         usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
//                     ]) {
//                         env.DOCKER_TAG = env.BRANCH_NAME.replaceAll('/', '-')
//                         sh './build.sh --push'
//                     }
//                 }
//             }
//         }
//     }
// }

properties([
    pipelineTriggers([
        [$class: "SCMTrigger", scmpoll_spec: "H/10 * * * *"],
        [$class: 'jenkins.triggers.ReverseBuildTrigger', upstreamProjects: "wicked.env/" + env.BRANCH_NAME.replaceAll("/", "%2F"), threshold: hudson.model.Result.SUCCESS]
    ])
])

node('docker') {

    stage('Checkout') {
        checkout scm
    }

    def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')

    echo 'Building docker tag: ' + dockerTag
    env.DOCKER_TAG = dockerTag

    // stage('SonarQube analysis') {
    //     if (dockerTag == 'next') {
    //         // requires SonarQube Scanner 2.8+
    //         def scannerHome = tool 'wicked-sonar';
    //         withSonarQubeEnv('sonar') {
    //             sh "${scannerHome}/bin/sonar-scanner"
    //         }
    //     } else {
    //         echo 'Skipping SonarQube, not "next" branch.'
    //     }
    // }

    stage('Build and Push') {
        withCredentials([
            usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
        ]) {
            
            sh './build.sh --push'

        }
    }
}
