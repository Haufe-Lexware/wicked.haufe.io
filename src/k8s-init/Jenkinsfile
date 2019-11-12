properties([
    pipelineTriggers([
        [$class: "SCMTrigger", scmpoll_spec: "H/10 * * * *"]
    ])
])

//node('build-jenkins-4-test') {
node('docker') {

    stage('Checkout') {
        checkout scm
    }

    def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')

    echo 'Building docker tag: ' + dockerTag
    env.DOCKER_TAG = dockerTag

    stage('Build and Push') {
        withCredentials([
            usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
        ]) {
            
            sh './build.sh --push'

        }
    }
}
