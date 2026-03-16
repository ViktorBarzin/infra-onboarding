<main class="content">
	<h1>Getting Started</h1>
	<p>Welcome! Follow these steps to get access to the home Kubernetes cluster.</p>

	<section>
		<h2>Step 0 — Join the VPN</h2>
		<p>The cluster is on a private network (<code>10.0.20.0/24</code>). You need VPN access first.</p>
		<ol>
			<li>Install <a href="https://tailscale.com/download" target="_blank">Tailscale</a> for your OS</li>
			<li>Run this in your terminal:
				<pre>tailscale login --login-server https://headscale.viktorbarzin.me</pre>
			</li>
			<li>A browser window will open with a registration URL</li>
			<li>Send that URL to Viktor via email (<a href="mailto:vbarzin@gmail.com">vbarzin@gmail.com</a>) or Slack</li>
			<li>Wait for approval (usually within a few hours)</li>
			<li>Once approved, test: <pre>ping 10.0.20.100</pre></li>
		</ol>
	</section>

	<section>
		<h2>Step 1 — Log in to the portal</h2>
		<p>Visit <a href="https://k8s-portal.viktorbarzin.me">k8s-portal.viktorbarzin.me</a> and sign in with your Authentik account.</p>
		<p>If you don't have an account yet, ask Viktor to create one.</p>
	</section>

	<section>
		<h2>Step 2 — Set up kubectl</h2>
		<p>Run one of these commands in your terminal to install everything automatically:</p>
		<h3>macOS</h3>
		<p class="prereq">Requires <a href="https://brew.sh" target="_blank">Homebrew</a>. Install it first if you don't have it.</p>
		<pre>bash &lt;(curl -fsSL https://k8s-portal.viktorbarzin.me/setup/script?os=mac)</pre>
		<h3>Linux</h3>
		<pre>bash &lt;(curl -fsSL https://k8s-portal.viktorbarzin.me/setup/script?os=linux)</pre>
		<h3>Windows</h3>
		<p>Use <a href="https://learn.microsoft.com/en-us/windows/wsl/install" target="_blank">WSL2</a> and follow the Linux instructions.</p>
	</section>

	<section>
		<h2>Step 3 — Install and log into Vault</h2>
		<p>Vault manages your secrets and issues dynamic Kubernetes credentials. First, install the Vault CLI:</p>
		<h3>macOS</h3>
		<pre>brew tap hashicorp/tap
brew install hashicorp/tap/vault</pre>
		<h3>Linux (Debian/Ubuntu)</h3>
		<pre>wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install vault</pre>
		<h3>Linux (other)</h3>
		<pre>curl -fsSL https://releases.hashicorp.com/vault/1.19.0/vault_1.19.0_linux_amd64.zip -o vault.zip
unzip vault.zip && sudo mv vault /usr/local/bin/ && rm vault.zip</pre>

		<p>Then configure it to point at our Vault server and log in:</p>
		<pre>export VAULT_ADDR="https://vault.viktorbarzin.me"

# Log in via Authentik SSO (opens browser)
vault login -method=oidc</pre>
		<p>After login, your token is saved to <code>~/.vault-token</code>. Add <code>VAULT_ADDR</code> to your shell profile so it persists:</p>
		<pre>echo 'export VAULT_ADDR="https://vault.viktorbarzin.me"' >> ~/.bashrc  # or ~/.zshrc</pre>
	</section>

	<section>
		<h2>Step 4 — Verify kubectl access</h2>
		<p>Run this command. It will open your browser for OIDC login the first time:</p>
		<pre>kubectl get pods -n YOUR_NAMESPACE</pre>
		<p>You should see an empty list (no resources) or your running pods.</p>
	</section>

	<section>
		<h2>Step 5 — Clone the infra repo</h2>
		<pre>git clone https://github.com/ViktorBarzin/infra.git
cd infra</pre>
		<p>This is where all the infrastructure configuration lives.</p>
	</section>

	<section>
		<h2>Step 6 — Create your first app stack</h2>
		<ol>
			<li>Copy the template: <pre>cp -r stacks/_template stacks/myapp
mv stacks/myapp/main.tf.example stacks/myapp/main.tf</pre></li>
			<li>Edit <code>stacks/myapp/main.tf</code> — replace all <code>&lt;placeholders&gt;</code></li>
			<li>Store secrets in Vault:
				<pre>vault kv put secret/YOUR_USERNAME/myapp DB_PASSWORD=secret123</pre>
			</li>
			<li>Add your app domain to <code>domains</code> list in Vault KV <code>k8s_users</code></li>
			<li>Submit a PR:
				<pre>git checkout -b feat/myapp
git add stacks/myapp/
git commit -m "add myapp stack"
git push -u origin feat/myapp</pre>
			</li>
			<li>Viktor reviews and merges</li>
			<li>After merge: <code>cd stacks/myapp && terragrunt apply</code></li>
		</ol>
	</section>
</main>

<style>
	.content { max-width: 768px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; }
	.content h1 { border-bottom: 1px solid #e0e0e0; padding-bottom: 0.5rem; }
	.content h2 { margin-top: 2rem; color: #333; }
	.content h3 { color: #666; margin: 1rem 0 0.25rem; }
	.content pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
	.content pre.output { background: #f5f5f5; color: #333; }
	.content code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
	.content .prereq { font-size: 0.9rem; color: #666; font-style: italic; }
	section { margin: 2rem 0; }
</style>
