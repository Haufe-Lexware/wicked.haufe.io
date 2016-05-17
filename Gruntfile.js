

module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        watch: {
            grunt: { files: ['Gruntfile.js'] },
            jade: {
                files: '*.jade',
                tasks: ['jade']
            }
        },
        jade: {
            compile: {
                options: {
                    pretty: true,
                },
                files: {
                    'index.html': 'index.jade',
                    'features.html': 'features.jade'
                }
            }
        }
    });
    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jade');
    grunt.loadNpmTasks('grunt-contrib-watch');
    // Default task.
    grunt.registerTask('default', 'Convert Jade templates into HTML files', ['jade', 'watch']);
};
