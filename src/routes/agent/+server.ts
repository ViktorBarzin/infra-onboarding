import type { RequestHandler } from './$types';

const BOOTSTRAP_DOC = `# Infrastructure Cluster — AI Agent Bootstrap

> Fetch this document: \`curl -fsSL https://k8s-portal.viktorbarzin.me/agent\`

## Quick Start

\`\`\`bash
# 1. Install tools (kubectl, kubelogin, kubeseal)
bash <(curl -fsSL https://k8s-portal.viktorbarzin.me/setup/script?os=linux)

# 2. Clone the infrastructure repo
git clone https://github.com/ViktorBarzin/infra.git && cd infra

# 3. Verify cluster access (opens browser for OIDC login on first run)
kubectl get namespaces
\`\`\`

## Critical Rules (MUST FOLLOW)

- **ALL changes through Terraform/Terragrunt** — NEVER \`kubectl apply/edit/patch/delete\` for persistent changes. Read-only kubectl is fine.
- **NEVER put secrets in plaintext** — use Sealed Secrets (\`kubeseal\`) or \`secrets.sops.json\` (SOPS-encrypted).
- **NEVER restart NFS on TrueNAS** — causes cluster-wide mount failures across all pods.
- **NEVER commit secrets** — triple-check before every commit.
- **\`[ci skip]\` in commit messages** when changes were already applied locally.
- **Ask before \`git push\`** — always confirm with the user first.

## Sealed Secrets (Self-Service)

You can manage your own secrets without SOPS access using \`kubeseal\`:

\`\`\`bash
# 1. Create a sealed secret
kubectl create secret generic <name> \\
  --from-literal=key=value -n <namespace> \\
  --dry-run=client -o yaml | \\
  kubeseal --controller-name sealed-secrets \\
    --controller-namespace sealed-secrets -o yaml > sealed-<name>.yaml

# 2. Place the file in the stack directory: stacks/<service>/sealed-<name>.yaml

# 3. Ensure the stack's main.tf has the fileset block (add if missing):
\`\`\`

\`\`\`hcl
resource "kubernetes_manifest" "sealed_secrets" {
  for_each = fileset(path.module, "sealed-*.yaml")
  manifest = yamldecode(file("\${path.module}/\${each.value}"))
}
\`\`\`

\`\`\`bash
# 4. Push to PR — CI runs terragrunt apply — controller decrypts into real K8s Secrets
\`\`\`

- Files MUST match the \`sealed-*.yaml\` glob pattern.
- Only the in-cluster controller has the private key. \`kubeseal\` uses the public key — safe to distribute.
- The \`kubernetes_manifest\` block is safe to add even with zero sealed-*.yaml files (empty for_each).

## SOPS Secrets (Admin-Only Fallback)

For secrets requiring admin access (shared infra passwords, API keys):
- **\`secrets.sops.json\`** — SOPS-encrypted secrets (JSON format)
- **Edit**: \`sops secrets.sops.json\` (opens $EDITOR, re-encrypts on save)
- **Add**: \`sops set secrets.sops.json '["new_key"]' '"value"'\`
- **Operators without SOPS keys**: comment on your PR asking Viktor to add the secret.

## Terraform Conventions

### Execution
- **Apply a service**: \`scripts/tg apply --non-interactive\` (auto-decrypts SOPS secrets)
- **Plan**: \`scripts/tg plan --non-interactive\`
- **kubectl**: \`kubectl --kubeconfig $(pwd)/config\`
- **Health check**: \`bash scripts/cluster_healthcheck.sh --quiet\`

### Key Paths
| Path | Purpose |
|------|---------|
| \`stacks/<service>/main.tf\` | Service definition |
| \`stacks/platform/modules/<module>/\` | Core infra modules (~22) |
| \`modules/kubernetes/ingress_factory/\` | Standardized ingress (auth, rate limiting, anti-AI) |
| \`modules/kubernetes/nfs_volume/\` | NFS volume module (CSI-backed, soft mount) |
| \`config.tfvars\` | Non-secret configuration (plaintext) |
| \`secrets.sops.json\` | All secrets (SOPS-encrypted JSON) |
| \`scripts/cluster_healthcheck.sh\` | 25-check cluster health script |
| \`AGENTS.md\` | Full AI agent instructions (auto-loaded by most agents) |

### Tier System
\`0-core\` | \`1-cluster\` | \`2-gpu\` | \`3-edge\` | \`4-aux\`

Kyverno auto-generates LimitRange + ResourceQuota per namespace based on tier label.
- Containers without explicit \`resources {}\` get default limits (256Mi for edge/aux — causes OOMKill for heavy apps)
- Always set explicit resources on containers that need more than defaults
- Opt-out labels: \`resource-governance/custom-quota=true\` / \`resource-governance/custom-limitrange=true\`

### Storage
- **NFS** (\`nfs-truenas\` StorageClass): For app data. Use the \`nfs_volume\` module.
- **iSCSI** (\`iscsi-truenas\` StorageClass): For databases (PostgreSQL, MySQL).

### Shared Variables (never hardcode)
\`var.nfs_server\`, \`var.redis_host\`, \`var.postgresql_host\`, \`var.mysql_host\`, \`var.ollama_host\`, \`var.mail_host\`

## Architecture

- Terragrunt-based homelab managing a Kubernetes cluster (5 nodes, v1.34.2) on Proxmox VMs
- 70+ services, each in \`stacks/<service>/\` with its own Terraform state
- Core platform: \`stacks/platform/modules/\` (Traefik, Kyverno, monitoring, dbaas, sealed-secrets, etc.)
- Public domain: \`viktorbarzin.me\` (Cloudflare) | Internal: \`viktorbarzin.lan\` (Technitium DNS)
- CI/CD: Woodpecker CI — PRs run plan, merges to master auto-apply platform stack

## Common Operations

### Deploy a New Service
1. Copy an existing stack as template: \`cp -r stacks/echo stacks/my-service\`
2. Edit \`main.tf\` — update image, ports, ingress, resources
3. Add DNS in \`config.tfvars\`
4. Apply platform first if needed, then the service

### Fix Crashed Pods
1. Run \`bash scripts/cluster_healthcheck.sh --quiet\`
2. Safe to delete evicted/failed pods and CrashLoopBackOff pods with >10 restarts
3. OOMKilled? Check \`kubectl describe limitrange tier-defaults -n <ns>\` and increase \`resources.limits.memory\`

### Add a Secret
- **Self-service**: Use \`kubeseal\` (see Sealed Secrets section above)
- **Admin**: \`sops set secrets.sops.json '["key"]' '"value"'\` then commit

## Contributing Workflow

1. Create a branch: \`git checkout -b fix/my-change\`
2. Make changes in \`stacks/<service>/main.tf\`
3. Push and open a PR: \`git push -u origin fix/my-change\`
4. Viktor reviews and merges
5. CI applies automatically — Slack notification when done

## Namespace-Owner Quick Start

If you're a namespace-owner (your user is in \`k8s_users\` with \`role: "namespace-owner"\`), follow this workflow to deploy your own apps:

### 1. Create Your Stack from Template
\`\`\`bash
cp -r stacks/_template stacks/myapp
mv stacks/myapp/main.tf.example stacks/myapp/main.tf
# Replace all <placeholders> in main.tf with your values
\`\`\`

### 2. Store Secrets in Vault
\`\`\`bash
vault login -method=oidc
vault kv put secret/<your-username>/myapp DB_PASSWORD=xxx API_KEY=yyy
\`\`\`
Your Vault path is \`secret/<your-username>/*\` — you have full CRUD access there and nowhere else.

### 3. Resource Constraints
- Your namespace has a **ResourceQuota** — you cannot exceed your CPU, memory, storage, or pod limits.
- **Always set explicit \`resources {}\`** on every container. Default: \`cpu = "10m"\`, \`memory = "256Mi"\`.
- Your pods run at **tier-4-aux** priority — they never preempt platform services.
- Storage quota: default **20Gi** total, **5 PVCs** max.

### 4. Submit a PR
\`\`\`bash
git checkout -b feat/myapp
git add stacks/myapp/
git commit -m "add myapp stack"
git push -u origin feat/myapp
# Open PR — admin reviews and runs terragrunt apply
\`\`\`

### What You CANNOT Do
- \`kubectl apply/edit/patch/delete\` for persistent changes (read-only kubectl only)
- Access resources outside your namespace (RBAC-enforced)
- Read other users' Vault secrets
- Run \`terragrunt apply\` (admin-only)
- Exceed your namespace quota
- Use \`:latest\` image tags (pull-through cache serves stale manifests)

## Infrastructure Details

- **Proxmox**: 192.168.1.127 (Dell R730, 22c/44t, 142GB RAM)
- **Nodes**: k8s-master (10.0.20.100), node1 (GPU, Tesla T4), node2-4
- **GPU workloads**: \`node_selector = { "gpu": "true" }\` + toleration \`nvidia.com/gpu\`
- **Pull-through cache**: 10.0.20.10 — use versioned image tags (cache serves stale :latest manifests)
- **MySQL InnoDB Cluster**: 3 instances on iSCSI
- **SMTP**: \`var.mail_host\` port 587 STARTTLS

## Further Reading

- Full agent instructions: \`AGENTS.md\` in the repo root
- Patterns and examples: \`.claude/reference/patterns.md\`
- Service catalog: \`.claude/reference/service-catalog.md\`
- Onboarding guide: https://k8s-portal.viktorbarzin.me/onboarding
`;

export const GET: RequestHandler = async () => {
	return new Response(BOOTSTRAP_DOC, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
