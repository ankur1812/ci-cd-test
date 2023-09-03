# CI/CD Deploy Pipeline

Setup for building Github Container Deployment for AWS

#### 1. Setup the build pipeline

This deployment pipeline triggers the workflow on a self-hosted AWS Server. The runner would require a docker image, published on a container registry (ghcr.io), which would be pulled and run in a docker container inside the AWS instance.

Steps for the build pipeline is available in  [CI/CD Build Pipeline](https://github.com/ankur1812/cicd-build-pipeline) project.

#### 2.Setup AWS EC2 instace

A VM can easily be provisioned through Amazon Web Services. Amazon Elastic Compute Cloud (Amazon EC2) provides secure, resizable compute capacity in the cloud.

- Signup / Login to AWS console.
- Go to EC2 Dashboard and `Launch a new EC2 Instance`
- Enter the configuration details:
  - Instance name
  - OS Image (This project uses Ubuntu)
  - Key-pair/login info (Either create a new one or select existing)
  - N/W Settings (Select both allow HTTP/HTTPS traffic)
- Launch Instance

#### 3. Login to EC2 Instance, update packages

Once the EC2 instance is provisioned, you can connect to it either using the key-pair used in the last step, or directly using EC2 Instance Connect feature of AWS. This would login you to the instance and you access its shell environment.

##### 3.1 Update the core apt and apt-get packages
  `sudo su `
  `sudo apt update`
  `sudo apt-get upgrade -y`

##### 3.2 Install Docker and NginX

Docker would be used to run the docker builds (published to the container repository in the build pipline from step 1) inside an docker containers.

Steps to install docker can be found in its official website. [https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)

NginX is required for the reverse proxy of the dockerized environment mapped to the default 80 port of the EC2 instance.
`sudo apt install nginx`


#### 4. Add the EC2 instace to the github project runners.
The EC2 instance needs to added as a runner to the github project actions. This runner would pick up the triggered deployment workflow once the build workflow is finihsed (after every commit/merge) and the latest docker image is pushed to the container registry.

Go to `Project Settings` > `Actions` > `Runners` > `New self-hosted runner`

You will see the setup steps for connecting the runner. Copy & paste each of the shell commands into your EC2 instance and execute them.

Note: For Linux, you can modify the last configuration command `$ ./run.sh` to `$ ./run.sh &` to run it in detached mode. The runner would be connected to your github project even when the EC2 console window is closed.

Once completed you would see the runner added to your Project `Actions` tab.

#### 5. Add the runner workflow / deployment pipeline

The deployment pipeline would be triggered after the build workflow. You would add a YAML file to trigger this deployment. The workflow would be exectued on your attached EC2 instance.

Go to Project > `Actions` > `New Workflow` > `Setup a Workflow Yourself`. 

Example deployment YAML is below

```
name: Deployment CD
# Name can be similar to the build pipeline, which could be "Deployment CI"

on:
  workflow_run:
    # NOTE: The build workflow name should be same as defined in it's YAML
    workflows: ["Deployment CI"]
    types:
      - completed

jobs:
  build:
    runs-on: self-hosted
    steps:
      - name: Login to ghcr.io
        run: sudo docker login -u [GITHUB_USERID] -p ${{ secrets.[GITHUB_ACCESS_TOKEN] }} ghcr.io
      - name: Pull docker image
        run: sudo docker pull ghcr.io/[GITHUB_USERID]/[PROJECT_IMAGE_NAME]:latest
      - name: Remove old container
        run: sudo docker rm -f /[PROJECT_IMAGE_NAME]-container || true
      - name: Run latest image in new container
        run: sudo docker run -d  -p 3000:3000 --name [PROJECT_IMAGE_NAME]-container ghcr.io/[GITHUB_USERID]/[PROJECT_IMAGE_NAME]
          
```
Commit/push the new changes. This would trigger the build pipeline and then the deployment pipeline (added in current step).

Note: 
- The docker login step uses the same `GITHUB_ACCESS_TOKEN` generated earlier for the buidl pipeline.
- The nodejs server used in this project uses port 3000. `sudo docker run` command in last step is using the same port mappings. This `-p 3000:3000` port mapping would change as per your project.

#### 6. Verify the deployment workflow

In the EC2 console, run the curl command to test if the docker container was instantiated.

You can run the `docker ps` command to check the latest deployment container intantiated in the deploy-workflow.
```
ubuntu@ip-172-31-43-72:~$ sudo docker ps
CONTAINER ID   IMAGE                                 COMMAND                  CREATED       STATUS       PORTS                                       NAMES
9621506a4291   ghcr.io/[GITHUB_USER]/[PROJECT_IMAGE]   "docker-entrypoint.s…"   3 hours ago   Up 3 hours   0.0.0.0:3000->3000/tcp, :::3000->3000/tcp   nodejs-test-image-container

ubuntu@ip-172-31-43-72:~$
```
You can check the PORTs and use the curl command to confirm it's running
`curl 0.0.0.0:3000` will give you the HTML/API response string.

#### 7. Update NginX for adding reverse proxy from the container

The NginX server will now be configured with the reverse proxy mapped to the docker containers IP address.

##### 7.1 Get the IP address of the container.

- Get the container ID using the `docker ps` command (same command as in step 6)
- Run the docker inspect command with the CONTAINER_ID to get it's IP Address
```
ubuntu@ip-172-31-43-72:~$ sudo docker inspect -f  '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' CONTAINER_ID

172.17.0.2
```

##### 7.2 Update the NginX config with the container's IP Address

- `cd /etc/nginx/sites-available`
- `vi default`

Check the location config inside the default file and udpate it with the IP Address
```

        location / {

                # -----------
                # Update the proxy_pass as
                # proxy_pass http://[IP_ADDRESS]:[PORT];

                proxy_pass http://172.17.0.2:3000;

                # -----------

                # First attempt to serve request as file, then
                # as directory, then fall back to displaying a 404.
                try_files $uri $uri/ =404;
        }
```

After updating the `default` file, restart the nginx server.
`systemctl restart nginx`

Once restarted, the default 80 port with revere-proxy to the docker's IP and return the HTML/API response.

Get the Public IPv4 address / DNS from the EC2 Details page and open in the link. The project would be live!

(Note: HTTP protocol might be needed since certificates are not added. Using the HTTPS protocol might not load the site.)


### 8. Your server is LIVE.
Your web/app server is now live. You can not proceed to adding certificates or ingress/exgress configurations.