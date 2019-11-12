import json
import os
import sys

def byteify(input):
    if isinstance(input, dict):
        return {byteify(key): byteify(value)
                for key, value in input.iteritems()}
    elif isinstance(input, list):
        return [byteify(element) for element in input]
    elif isinstance(input, unicode):
        return input.encode('utf-8')
    else:
        return input

def version_file(package_file, new_version):
    print "Loading " + package_file + "..." 
    with open(package_file, 'r') as package_content:
        package_json = byteify(json.loads(package_content.read()))
    
    print "Setting version to " + new_version
    package_json['version'] = new_version
    
    with open(package_file, 'w') as package_content:
        json.dump(package_json, package_content, indent = 2)

    print "Done."

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print "Usage:"
        print "   python _versionize.py <package.json file> <version>"
        sys.exit(1)

    version_file(sys.argv[1], sys.argv[2])
