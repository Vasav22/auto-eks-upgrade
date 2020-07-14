pipeline {
    agent any
    stages {
        stage('analyze') {
            steps {
                sh 'echo $docker_url > anchore_images'
                anchore name: 'anchore_images'
            }
        }
    }
}