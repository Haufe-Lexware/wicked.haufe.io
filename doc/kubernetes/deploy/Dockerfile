FROM haufelexware/k8s-deploy-env:latest

COPY . /root/deploy
RUN mkdir -p /root/.kube
COPY kubeconfig /root/.kube/config

WORKDIR /root/deploy

ENTRYPOINT ["/root/deploy/deploy.sh"]
CMD ["", ""]
