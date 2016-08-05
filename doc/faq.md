# FAQ/Docs

Q: what is this `start.sh` about?

A: The script bundle a couple of things together that usually would be provided/handled by some
CI/CD process. 

Most important are:

* `start.sh --build`:        build reuqired containers in the correct sequence 
* `start.sh --start`:        starts the container set
* `start.sh --scale <num>`:  sets the number of running kong instances

If you want to execute the commands on a remote machine, simply use this instead of the simple `start.sh`:

```bash 
start.sh --env <docker-machine storage path> <docker-machine name> ...
```

- https://github.com/docker/dockercloud-haproxy
