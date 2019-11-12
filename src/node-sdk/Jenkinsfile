properties([
    pipelineTriggers([
        // [$class: "SCMTrigger", scmpoll_spec: "H/10 * * * *"]
    ])
])

node('docker') {

    stage('Checkout') {
        checkout scm
    }

    stage('Build and Publish') {
        withCredentials([
            usernamePassword(credentialsId: 'npmjs_wicked', usernameVariable: 'NPM_USER', passwordVariable: 'NPM_PASS'),
            string(credentialsId: 'npmjs_wicked_email', variable: 'NPM_EMAIL')
        ]) {
            sh './publish.sh'
        }
    }
}
