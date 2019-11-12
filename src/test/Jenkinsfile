properties([
    disableConcurrentBuilds(),
    parameters([
        string(
            name: 'DOCKER_PREFIX',
            defaultValue: 'haufelexware/wicked.',
            description: 'Docker image prefix to use when testing.',
            required: false
        ),
        string(
            name: 'FEATURE_BRANCH_OVERRIDE',
            defaultValue: '',
            description: 'Specify a feature branch you want to test with this branch of the tests. Tests will fall back to "next" images branch tag is not present.',
            required: false
        )
    ]),
    pipelineTriggers([
        [$class: "SCMTrigger", scmpoll_spec: "H/10 * * * *"],
        [$class: 'jenkins.triggers.ReverseBuildTrigger', upstreamProjects: 
            "wicked.ui/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.api/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.kong-adapter/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.auth/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.kong/" + env.BRANCH_NAME.replaceAll("/", "%2F"),
            threshold: hudson.model.Result.SUCCESS]
    ])
])

node('docker') {

    stage('Checkout') {
        checkout scm
    }

    def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')
    if (params.FEATURE_BRANCH_OVERRIDE != "")
        dockerTag = params.FEATURE_BRANCH_OVERRIDE.replaceAll('/', '-');

    echo 'Using docker tag:    ' + dockerTag
    env.DOCKER_TAG = dockerTag
    echo 'Using docker prefix: ' + params.DOCKER_PREFIX
    env.DOCKER_PREFIX = params.DOCKER_PREFIX

    // stage('Nothingburger') {
    //     echo 'Currently, the automatic tests are not active.'
    // }

    // stage('API Tests') {
    //     env.BUILD_ALPINE = '';
    //     sh './run-api-tests.sh'
    // }

    // stage('API Tests (alpine)') {
    //     env.BUILD_POSTGRES = '';
    //     env.BUILD_ALPINE = '-alpine';
    //     sh './run-api-tests.sh'
    // }

    stage('API Tests (postgres)') {
        env.BUILD_POSTGRES = '';
        env.BUILD_POSTGRES = 'true';
        env.BUILD_ALPINE = '';
        sh './run-api-tests.sh'
    }

    stage('API Tests (postgres, alpine)') {
        env.BUILD_POSTGRES = 'true';
        env.BUILD_ALPINE = '-alpine';
        sh './run-api-tests.sh'
    }

    // stage('Portal Tests') {
    //     echo 'Skipping (not yet implemented)'
    //     // env.BUILD_ALPINE = '';
    //     // env.REDIS_SESSIONS = '';
    //     // sh './run-portal-tests.sh'
    // }

    // stage('Portal Tests (alpine)') {
    //     echo 'Skipping (not yet implemented)'
    //     // env.BUILD_ALPINE = '-alpine';
    //     // env.REDIS_SESSIONS = '';
    //     // sh './run-portal-tests.sh'
    // }

    // stage('Portal Tests (redis)') {
    //     echo 'Skipping (not yet implemented)'
    //     // env.BUILD_ALPINE = '';
    //     // env.REDIS_SESSIONS = 'true';
    //     // sh './run-portal-tests.sh'
    // }

    // stage('Portal Tests (redis, alpine)') {
    //     echo 'Skipping (not yet implemented)'
    // //     env.BUILD_ALPINE = '-alpine';
    // //     env.REDIS_SESSIONS = 'true';
    // //     sh './run-portal-tests.sh'
    // }

    // stage('Kong Adapter Tests') {
    //     env.BUILD_ALPINE = ''
    //     env.BUILD_POSTGRES = ''
    //     sh './run-kong-adapter-tests.sh'
    // }

    // stage('Kong Adapter Tests (alpine)') {
    //     env.BUILD_ALPINE = '-alpine'
    //     env.BUILD_POSTGRES = ''
    //     sh './run-kong-adapter-tests.sh'
    // }

    stage('Kong Adapter Tests (postgres)') {
        env.BUILD_ALPINE = ''
        env.BUILD_POSTGRES = 'true'
        sh './run-kong-adapter-tests.sh'
    }

    stage('Kong Adapter Tests (postgres, alpine)') {
        env.BUILD_ALPINE = '-alpine'
        env.BUILD_POSTGRES = 'true'
        sh './run-kong-adapter-tests.sh'
    }

    // ===========================

    // stage('Auth Server Tests') {
    //     env.BUILD_ALPINE = ''
    //     env.BUILD_POSTGRES = ''
    //     sh './run-auth-tests.sh'
    // }

    // stage('Auth Server Tests (alpine)') {
    //     env.BUILD_ALPINE = '-alpine'
    //     env.BUILD_POSTGRES = ''
    //     sh './run-auth-tests.sh'
    // }

    stage('Auth Server Tests (postgres)') {
        env.BUILD_ALPINE = ''
        env.BUILD_POSTGRES = 'true'
        sh './run-auth-tests.sh'
    }

    stage('Auth Server Tests (postgres, alpine)') {
        env.BUILD_ALPINE = '-alpine'
        env.BUILD_POSTGRES = 'true'
        sh './run-auth-tests.sh'
    }
}
