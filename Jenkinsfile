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
        withCredentials([
            usernamePassword(credentialsId: 'dockerhub_wicked', usernameVariable: 'DOCKER_REGISTRY_USER', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')
        ]) {
            
            sh './src/build.sh'
            sh './src/push.sh'

        }
    }

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
