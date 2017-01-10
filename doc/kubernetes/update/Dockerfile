FROM haufelexware/k8s-deploy-env:latest

COPY . /root/deploy
RUN mkdir -p /root/.kube
COPY kubeconfig /root/.kube/config

ENTRYPOINT ["/root/deploy/update-revision.sh"]
# We probably won't need parameters, but who knows
CMD ["", ""]
