# Task Manager on K3s

A containerized Task Manager application deployed on a multi-node K3s Kubernetes cluster. The project demonstrates Kubernetes application deployment, persistent storage, automated database backups, networking, resource management, and security best practices.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Container Images](#container-images)
- [Prerequisites](#prerequisites)
- [Configuration and Secrets](#configuration-and-secrets)
- [Deployment](#deployment)
- [Verification and Testing](#verification-and-testing)
- [Security](#security)
- [Database Backup and Restore](#database-backup-and-restore)
- [Troubleshooting](#troubleshooting)
- [Screenshots](#screenshots)

## Project Overview

The application provides a web interface for managing tasks. Its frontend is served by Nginx, while a Node.js and Express API handles task operations and communicates with PostgreSQL.

The application runs in a dedicated Kubernetes namespace named `task-manager`.

The project demonstrates:

- Deployments and Services for application components.
- A PostgreSQL StatefulSet with persistent storage.
- Kubernetes Ingress routing through Traefik.
- ConfigMaps and Secrets for configuration.
- ResourceQuota and LimitRange.
- Liveness and readiness probes.
- Automated PostgreSQL backups using a CronJob.
- Database restoration testing.
- Role-Based Access Control (RBAC).
- NetworkPolicies restricting application traffic.
- Container security contexts and resource limits.

## Architecture

```text
                         User / Web Browser
                                 |
                                 v
                    Traefik Ingress Controller
                       Host: app.k3s.local
                                 |
                                 v
                       frontend-svc :80
                                 |
                                 v
                    Frontend Deployment
                    Nginx, 2 replicas
                                 |
                       /api/ requests
                                 |
                                 v
                         api-svc :3000
                                 |
                                 v
                       API Deployment
                       Node.js / Express
                          2 replicas
                                 |
                                 v
                         db :5432
                       Headless Service
                                 |
                                 v
                    PostgreSQL StatefulSet
                          db-0 Pod
                                 |
                                 v
                         data-db-0 PVC

                    db-backup CronJob
                                 |
                                 v
                         PostgreSQL dump
                                 |
                                 v
                         db-backup-pvc
```

Only the frontend is exposed through Ingress. The API and database are accessed through internal Kubernetes Services.

## Technology Stack

| Component               | Technology                               |
| ----------------------- | ---------------------------------------- |
| Kubernetes distribution | K3s                                      |
| Container runtime       | containerd                               |
| Frontend                | HTML, CSS/JavaScript, Nginx              |
| Backend API             | Node.js, Express                         |
| Database                | PostgreSQL                               |
| Ingress                 | Traefik                                  |
| Persistent storage      | Kubernetes PVCs, local-path StorageClass |
| Automated backups       | Kubernetes CronJob and `pg_dump`         |
| Security                | RBAC, NetworkPolicies, security contexts |
| Container registry      | Docker Hub                               |

## Repository Structure

```text
task-manager-k3s/
├── app/
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   └── nginx.conf
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── db.js
│   │   ├── package.json
│   │   └── server.js
│   └── database/
│       ├── Dockerfile
│       └── init.sql
├── k8s/
│   ├── app/
│   │   ├── api-deployment.yaml
│   │   ├── api-service.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── frontend-service.yaml
│   │   └── ingress.yaml
│   ├── base/
│   │   ├── configmap.yaml
│   │   ├── limitrange.yaml
│   │   ├── namespace.yaml
│   │   ├── resourcequota.yaml
│   │   └── secret.example.yaml
│   ├── security/
│   │   ├── networkpolicies.yaml
│   │   └── rbac.yaml
│   └── storage/
│       ├── backup-pvc.yaml
│       ├── db-backup-cronjob.yaml
│       ├── db-service.yaml
│       └── db-statefulset.yaml
├── .gitignore
└── README.md
```

**Security note:** The actual `k8s/base/secret.yaml` file is intentionally excluded from Git. Only the example template is included.

## Container Images

The project uses versioned images published to Docker Hub.

| Component | Image                                    |
| --------- | ---------------------------------------- |
| Frontend  | `bahaessid/task-manager-frontend:v1.0.0` |
| API       | `bahaessid/task-manager-api:v1.0.0`      |
| Database  | `bahaessid/task-manager-db:v1.0.0`       |

The Kubernetes manifests use explicit image tags instead of `latest`.

## Prerequisites

- A working K3s cluster with a reachable Kubernetes API.
- `kubectl` configured to access the cluster.
- Traefik Ingress Controller.
- A functioning Kubernetes NetworkPolicy implementation.
- A default StorageClass capable of provisioning persistent volumes, such as `local-path`.
- Access to the container images in Docker Hub.
- A workstation capable of resolving `app.k3s.local` to the cluster's reachable address.

Check the cluster before deployment:

```bash
kubectl get nodes
kubectl get pods -A
kubectl get ingressclass
kubectl get storageclass
```

## Configuration and Secrets

Non-sensitive configuration is stored in the `task-manager-config` ConfigMap. Database credentials are stored in the `task-manager-db-secret` Kubernetes Secret.

The file `k8s/base/secret.example.yaml` is a template. Before deploying to a new environment:

1. Create a local `k8s/base/secret.yaml` based on the example.
2. Replace the placeholder password with a strong, environment-specific value.
3. Use the same database username, database name, and password for the PostgreSQL and API settings.
4. Never commit the real Secret manifest or actual credentials.

For an existing deployment, the Secret is created separately from the other manifests.

## Deployment

Run the following commands from the project root, with `kubectl` configured for the target cluster.

### 1. Create the namespace and base configuration

```bash
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/limitrange.yaml
kubectl apply -f k8s/base/resourcequota.yaml
```

Create the local Secret separately:

```bash
kubectl apply -f k8s/base/secret.yaml
```

### 2. Apply RBAC and storage

```bash
kubectl apply -f k8s/security/rbac.yaml
kubectl apply -f k8s/storage/db-service.yaml
kubectl apply -f k8s/storage/db-statefulset.yaml
```

Wait for PostgreSQL to become ready:

```bash
kubectl rollout status statefulset/db -n task-manager
kubectl get pods,pvc -n task-manager
```

### 3. Deploy the API

```bash
kubectl apply -f k8s/app/api-deployment.yaml
kubectl apply -f k8s/app/api-service.yaml
kubectl rollout status deployment/api -n task-manager
```

### 4. Deploy the frontend and Ingress

```bash
kubectl apply -f k8s/app/frontend-deployment.yaml
kubectl apply -f k8s/app/frontend-service.yaml
kubectl apply -f k8s/app/ingress.yaml
kubectl rollout status deployment/frontend -n task-manager
```

### 5. Configure backup storage and scheduling

```bash
kubectl apply -f k8s/storage/backup-pvc.yaml
kubectl apply -f k8s/storage/db-backup-cronjob.yaml
```

### 6. Apply NetworkPolicies

```bash
kubectl apply -f k8s/security/networkpolicies.yaml
```

Verify the resources:

```bash
kubectl get pods,svc,ingress,pvc -n task-manager
kubectl get networkpolicy -n task-manager
kubectl get cronjob -n task-manager
```

### 7. Access the application

Configure the workstation's hosts file to map `app.k3s.local` to the reachable cluster node address.

For the development environment used during testing:

```text
192.168.213.132 app.k3s.local
```

Then open:

```text
http://app.k3s.local
```

The IP address above is specific to the tested environment and must be replaced if the cluster address changes.

## Verification and Testing

The following tests were performed against the deployed cluster.

### 1. Kubernetes resources

The frontend and API Deployments reached two available replicas each. PostgreSQL ran as the `db-0` StatefulSet Pod.

The database and backup PVCs were provisioned and reached the `Bound` state.

### 2. Frontend and API access

The frontend was accessible through Traefik Ingress.

The API was tested through its internal Service using port forwarding. The `/health` endpoint returned HTTP 200, and `/ready` returned HTTP 200 with the database reported as connected.

The task endpoint was tested through the frontend proxy:

```bash
curl -i -H "Host: app.k3s.local" \
  http://192.168.213.132/api/tasks
```

The endpoint returned HTTP 200.

### 3. Task creation

A task was created through the Ingress endpoint and returned HTTP 201 Created.

The task was subsequently retrieved through the API, confirming that the application could write to and read from PostgreSQL.

### 4. Persistent database storage

A task named `Persistence Test` was created and its presence verified.

The PostgreSQL Pod was then deleted:

```bash
kubectl delete pod db-0 -n task-manager
```

The StatefulSet automatically recreated the Pod. After it became ready, the task was queried again and remained present.

This demonstrates persistence across PostgreSQL Pod recreation using the StatefulSet's PVC. The PVC itself was not deleted.

### 5. Automated database backup

The CronJob is configured to run daily at 02:00 according to the cluster controller's time zone.

A manual backup Job was created from the CronJob template:

```bash
kubectl create job \
  --from=cronjob/db-backup \
  db-backup-manual \
  -n task-manager
```

The Job completed successfully. Its logs confirmed that the database was reachable and a PostgreSQL dump was created on the backup PVC.

The generated dump was inspected, and its contents were restored into a separate temporary database. The restored database contained the `public.tasks` table. The temporary restoration database was then removed.

The backup PVC is separate from the database's data PVC.

### 6. NetworkPolicy enforcement

The policies permit the intended traffic:

- Traefik to the frontend.
- Frontend to the API.
- API to PostgreSQL.
- Backup Job to PostgreSQL.
- DNS lookups required by the application.

A temporary Pod labelled as a frontend Pod was used to test direct access to PostgreSQL. The connection was blocked, confirming that the frontend-to-database path was restricted.

The normal application route continued to work after the policies were applied.

### 7. RBAC verification

The dedicated viewer ServiceAccount was tested using Kubernetes authorization checks.

Listing Pods in the application namespace was permitted:

```bash
kubectl auth can-i list pods \
  -n task-manager \
  --as=system:serviceaccount:task-manager:task-manager-viewer
```

Reading Secrets was denied:

```bash
kubectl auth can-i get secrets \
  -n task-manager \
  --as=system:serviceaccount:task-manager:task-manager-viewer
```

This demonstrates the intended least-privilege access for the viewer account.

## Security

The deployment includes the following security measures:

- A dedicated `task-manager` namespace.
- ResourceQuota and LimitRange.
- ConfigMap for non-sensitive settings and Secret for database credentials.
- A dedicated application ServiceAccount with automatic token mounting disabled.
- A namespace-scoped viewer Role and RoleBinding.
- No viewer permissions to read Secrets.
- NetworkPolicies restricting application communication.
- Non-root container execution where configured.
- RuntimeDefault seccomp profiles.
- Disabled privilege escalation and dropped Linux capabilities.
- CPU and memory requests and limits.
- Internal ClusterIP Services for the API and database.
- Ingress exposure limited to the frontend.

Kubernetes Secrets are encoded rather than automatically encrypted at rest by virtue of being Secrets. Production deployments should also use appropriate cluster access controls and encryption-at-rest configuration.

## Database Backup and Restore

List the backup Jobs:

```bash
kubectl get cronjob,jobs -n task-manager
kubectl get pvc -n task-manager
```

Inspect the most recent backup Job logs:

```bash
kubectl logs job/db-backup-manual -n task-manager
```

List the backup files by creating a temporary inspection Pod with the backup PVC mounted, or by inspecting the volume through an appropriately authorized maintenance workflow.

For a restore, use a PostgreSQL-compatible environment and restore into a separate database first. Verify the restored tables and data before considering recovery complete.

**Important:** Do not delete the database or backup PVCs during normal Pod-recreation tests. The current `local-path` StorageClass provides node-local storage and is not, by itself, a highly available or off-cluster backup solution. Production backups should also be copied to independent storage.

## Troubleshooting

Check Pod status and events:

```bash
kubectl get pods -n task-manager
kubectl describe pod <pod-name> -n task-manager
kubectl get events -n task-manager --sort-by=.metadata.creationTimestamp
```

Check API and frontend logs:

```bash
kubectl logs deployment/api -n task-manager
kubectl logs deployment/frontend -n task-manager
```

Check PostgreSQL:

```bash
kubectl logs db-0 -n task-manager
kubectl get pvc -n task-manager
```

Check routing and policy resources:

```bash
kubectl describe ingress task-manager-ingress -n task-manager
kubectl get networkpolicy -n task-manager
kubectl get svc -n task-manager
```

If a Pod cannot start, verify image availability, resource limits, Secret values, PVC status, and Pod events before changing the manifests.

## Screenshots

Add screenshots from the actual deployed environment to document the results.

Suggested screenshots:

1. **Cluster Nodes** — all K3s nodes in the `Ready` state.
2. **Application Homepage** — Task Manager accessible at `http://app.k3s.local`.
3. **Kubernetes Workloads** — frontend and API replicas, plus PostgreSQL.
4. **Persistent Storage** — database and backup PVCs in the `Bound` state.
5. **Persistence Test** — the test task still present after PostgreSQL Pod recreation.
6. **Backup Job** — successful backup Job status and logs.
7. **Restore Test** — the temporary restored database containing the `tasks` table.
8. **NetworkPolicy Test** — frontend-to-database access blocked.
9. **RBAC Test** — viewer allowed to list Pods but denied access to Secrets.

Example layout:

```markdown
### Application Homepage

![Task Manager homepage](screenshots/application-homepage.png)

### Persistence Test

![Task survives database Pod recreation](screenshots/persistence-test.png)

### Backup Job

![Successful database backup](screenshots/backup-job.png)
```

Replace the example paths with real screenshots captured from the project.

## Conclusion

This project demonstrates the deployment and operation of a small multi-component application on K3s, including internal service discovery, persistent PostgreSQL storage, scheduled database backups, restore validation, resource controls, RBAC, and NetworkPolicy enforcement.
