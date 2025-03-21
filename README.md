# Setting up and Deploying the HCL AppScan Integration for Jira Cloud Plugin

This document shows how  to set up, configure, and deploy the open-source HCL AppScan Integration for Jira Cloud plugin. This plugin integrates with AppScan 360° running on a local network, using Ngrok to expose the backend to Jira Cloud.
Ngrok is used for tunneling in this implementation, but the system's architecture is vendor-neutral. You have the flexibility to choose from various tunneling services based on your needs, budget, and existing infrastructure. Tunneling is only required when the server is behind a firewall or NAT and not directly accessible from the internet. If your AppScan 360° Server is already accessible via a domain name,you can proceed directly past step 5, as tunneling isn't needed.

# Prerequisites: 

Before you begin, ensure you have the following:

* A Jira Cloud instance with administrative privileges.

* Node.js version v20.8.1 or later, and npm (or yarn) are installed.

* The Forge CLI installed:  
  * npm install \-g @forge/cli  
    The Forge CLI is the command-line interface for developing Forge apps, which allows you to create, build, and deploy Jira apps.

* A server with AppScan 360° installed.

* A GitHub account.

# Steps: 

1. **Generate a Forge App ID:**

   

   1. Create or use an existing Atlassian API token to log in to the CLI. The CLI uses your token when running commands.

   2. Go to https://id.atlassian.com/manage/api-tokens.

   3. Click Create API token.

   4. Enter a label to describe your API token. For example, forge-api-token.

   5. Click Create.

   6. Click Copy to clipboard and close the dialog.

   7. Log in to the Forge CLI to start using Forge command \- forge login

   8. Enter the email address associated with your Atlassian account.

   9. Enter your Atlassian API token. You copied this to the clipboard in step vi.

   10. Navigate to the directory where you want to create the app. A new subdirectory with the app’s name will be created there.

   		

   11. Create a new Forge app:

          forge create

   12. Enter a name for your app (up to 50 characters).

   13. Select the UI Kit category.

   14. Select the Jira product.

   15. Select the jira-admin-page template.

   16. Navigate to the app subdirectory to see the app files.

       

The Forge CLI generates an app id in the manifest.yml file. Be sure to **note this app id  as you'll need it later.**

2. **Signup and Install Ngrok on the AppScan 360° Server:**

   Ngrok is a tunneling service that allows you to expose your local server to the internet. Follow these steps to install it:

   1. Signup and download Ngrok from the [official website](https://ngrok.com/download).  
   2. Install Ngrok on the server where AppScan 360° is running.

   To install Ngrok via Apt, use the following command:
```
      curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok

```
   Refer to this link for other OS - [Download Ngrok](https://ngrok.com/downloads).

   Note: Ngrok’s free tier has limitations (such as limited bandwidth and connections). For production environments, it’s recommended to use a paid Ngrok plan or set up a reverse proxy for more stable connections.

   For more details on Ngrok setup, visit: [Ngrok Setup Guide](https://dashboard.ngrok.com/get-started/setup).

   

3. Add your Ngrok Authtoken:  
   Run the following command to add your authtoken to the default ngrok.yml [configuration file](https://ngrok.com/docs/agent/config/):  
   ```  
   ngrok config add-authtoken <your_auth_token>  
   ```  
     
4. **Create a Domain (optional):**  
     
   A domain allows you to create public endpoints with hostnames that match your domain. For example, after creating the domain your-name.ngrok.app, you can create the endpoint https://your-name.ngrok.app  
     
   You can use a subdomain of an Ngrok’s managed domains (example., foo.ngrok.app). Alternatively, if you own a domain, you can set it up by creating a CNAME DNS record with your domain's DNS provider. You can manage domains in your Ngrok [dashboard](https://dashboard.ngrok.com/domains).  
5. **Create a public endpoint:**  
     
   A domain enables you to create [public endpoints](https://ngrok.com/docs/universal-gateway/public-endpoints/) with  hostnames that match the domain. These are called "matching endpoints". For example, after you create the domain app.example.com, you can create the endpoint https://app.example.com.  
     
     
   An endpoint exists for the duration of the process and forwards traffic to a specified port or URL.  
   To create an endpoint and forward its traffic to a local port:  
     
   1. Start Ngrok, exposing the port on which AppScan 360°'s REST API is listening. Replace \<port\> with the actual port number:  
      - kubectl get services \-A  
      - Find the IP address corresponding to ascp-mr-user-api  
      - Execute the below command:  
        
```
   nohup ngrok http <ip address>:<port> --url <endpoint> > ngrok.log 2>&1 & 
```
  nohup allows a process to continue running even after you log out or close the terminal.  
     
   b. Copy the URL provided by Ngrok, as it will be your backend URL.  
     
6. **Fork and Clone the Github Repository:**

   1. Fork the plugin's repository on GitHub ([https://github.com/HCL-TECH-SOFTWARE/appscan-native-jira-integration](https://github.com/HCL-TECH-SOFTWARE/appscan-native-jira-integration))  to your account.

   2. Clone the forked repository to your local machine:
```
   git clone https://github.com/<your-username>/<repository-name>.git

   cd <repository-name>
```
7. **Configure the Plugin:**  
   1. Open the manifest.yml file in the plugin's root directory.  
   2. Replace the placeholder backend-url with the Ngrok URL you copied in step 6\. Also , update the app id you generated in step 1 in the manifest file.  For example:

  ```yaml
	external:
	  fetch:
	    backend:
	      - https://*.appscan.com
	      - <backend-url>
 ```
```yaml
  app:  
    id: <your-app-id> \# Make sure the app id is correct.
```

9. **Install Plugin Dependencies:**

   1. Navigate to the plugin's root directory in your terminal and install the required dependencies:
   ```
   npm install  
   ```
10. **Build and Deploy the Plugin:**

   1. Navigate to the app's top-level directory and deploy your app by running:

          forge deploy

   2. Install your app by running:

          forge install

   3. Select your Atlassian product using the arrow keys and press the enter key.

   4. Enter the URL for your development site. For example, example.atlassian.net

   5. Once the successful installation message appears, your app is installed and ready to use on the specified site. You can always delete your app from the site by running the forge uninstall command.

11. **Test the Plugin:**

    Navigate to the app using App → Manage your apps. Use the app in Jira to verify that it's working correctly and communicating with your AppScan 360° instance via Ngrok.

**Important Considerations:**

* **Ngrok Limitations:** Ngrok’s free tier is useful for testing but may not handle production-level traffic. For production use, consider upgrading to a paid Ngrok plan or using a reverse proxy for more reliable performance and scalability.  
* **Security**: Exposing internal services via Ngrok can pose security risks. Ensure you are using proper authentication and encryption when setting up public endpoints. If you’re using a reverse proxy, ensure it's behind appropriate firewalls and protected with SSL/TLS certificates.

**Troubleshooting**:

If you encounter issues during setup, consider the following:

**1\. Ngrok Connection Issues**: Ensure your Ngrok tunnel is running and the endpoint URL matches the one in your manifest.yml.

**2\. AppScan 360° Connectivity**: Double-check the port configuration and network settings on the server running AppScan 360°.

**3\. Forge Deployment Failures**: Verify your Forge app settings, including the App ID and any required permissions.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

