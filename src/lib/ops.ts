// GENERATED from a live Honcho's /openapi.json.
// This catalog is the coverage contract: the Operations screen renders one
// entry per item, so every endpoint the server exposes is reachable from the
// dashboard even before it gets a bespoke screen. Regenerate when Honcho is
// upgraded rather than hand-editing.

export type OpParam = { name: string; in: string; required: boolean };
export type Op = {
  id: string;
  method: string;
  path: string;
  summary: string;
  group: string;
  destructive: boolean;
  hasBody: boolean;
  bodySchema: string;
  params: OpParam[];
  cli: string;
};

export const OPERATIONS: Op[] = [
  {
    "id": "get:/health",
    "method": "GET",
    "path": "/health",
    "summary": "Health Check",
    "group": "health",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [],
    "cli": "honcho doctor"
  },
  {
    "id": "post:/v3/keys",
    "method": "POST",
    "path": "/v3/keys",
    "summary": "Create Key",
    "group": "keys",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "query",
        "required": false
      },
      {
        "name": "peer_id",
        "in": "query",
        "required": false
      },
      {
        "name": "session_id",
        "in": "query",
        "required": false
      },
      {
        "name": "expires_at",
        "in": "query",
        "required": false
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces",
    "method": "POST",
    "path": "/v3/workspaces",
    "summary": "Get Or Create Workspace",
    "group": "workspaces",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "WorkspaceCreate",
    "params": [],
    "cli": "honcho workspace create <id>"
  },
  {
    "id": "post:/v3/workspaces/list",
    "method": "POST",
    "path": "/v3/workspaces/list",
    "summary": "Get All Workspaces",
    "group": "workspaces",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Options",
    "params": [
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho workspace list"
  },
  {
    "id": "delete:/v3/workspaces/{workspace_id}",
    "method": "DELETE",
    "path": "/v3/workspaces/{workspace_id}",
    "summary": "Delete Workspace",
    "group": "workspaces",
    "destructive": true,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho workspace delete <id>"
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}",
    "summary": "Update Workspace",
    "group": "workspaces",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "WorkspaceUpdate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/chat",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/chat",
    "summary": "Workspace Chat",
    "group": "workspaces",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "WorkspaceChatOptions",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho workspace chat <query>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/conclusions",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/conclusions",
    "summary": "Create Conclusions",
    "group": "conclusions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "ConclusionBatchCreate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho conclusion create"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/conclusions/list",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/conclusions/list",
    "summary": "List Conclusions",
    "group": "conclusions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Options",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho conclusion list"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/conclusions/query",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/conclusions/query",
    "summary": "Query Conclusions",
    "group": "conclusions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "ConclusionQuery",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho conclusion search <query>"
  },
  {
    "id": "delete:/v3/workspaces/{workspace_id}/conclusions/{conclusion_id}",
    "method": "DELETE",
    "path": "/v3/workspaces/{workspace_id}/conclusions/{conclusion_id}",
    "summary": "Delete Conclusion",
    "group": "conclusions",
    "destructive": true,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "conclusion_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho conclusion delete <id>"
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/conclusions/{conclusion_id}",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/conclusions/{conclusion_id}",
    "summary": "Get Conclusion",
    "group": "conclusions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "conclusion_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/peers",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/peers",
    "summary": "Get Or Create Peer",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "PeerCreate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho peer create <id>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/peers/list",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/peers/list",
    "summary": "Get Peers",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Options",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho peer list"
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}/peers/{peer_id}",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}",
    "summary": "Update Peer",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "PeerUpdate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/peers/{peer_id}/card",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/card",
    "summary": "Get Peer Card",
    "group": "peers",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      },
      {
        "name": "target",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho peer card <id>"
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}/peers/{peer_id}/card",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/card",
    "summary": "Set Peer Card",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "PeerCardSet",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      },
      {
        "name": "target",
        "in": "query",
        "required": false
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/peers/{peer_id}/chat",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/chat",
    "summary": "Peer Chat",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "DialecticOptions",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho peer chat <query>"
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/peers/{peer_id}/context",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/context",
    "summary": "Get Peer Context",
    "group": "peers",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      },
      {
        "name": "target",
        "in": "query",
        "required": false
      },
      {
        "name": "search_query",
        "in": "query",
        "required": false
      },
      {
        "name": "search_top_k",
        "in": "query",
        "required": false
      },
      {
        "name": "search_max_distance",
        "in": "query",
        "required": false
      },
      {
        "name": "include_most_frequent",
        "in": "query",
        "required": false
      },
      {
        "name": "max_conclusions",
        "in": "query",
        "required": false
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/peers/{peer_id}/representation",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/representation",
    "summary": "Get Representation",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "PeerRepresentationGet",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho peer representation <id>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/peers/{peer_id}/search",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/search",
    "summary": "Search Peer",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "MessageSearchOptions",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho peer search <query>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/peers/{peer_id}/sessions",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/peers/{peer_id}/sessions",
    "summary": "Get Sessions For Peer",
    "group": "peers",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Options",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/queue/status",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/queue/status",
    "summary": "Get Queue Status",
    "group": "queue",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "observer_id",
        "in": "query",
        "required": false
      },
      {
        "name": "sender_id",
        "in": "query",
        "required": false
      },
      {
        "name": "session_id",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho workspace queue-status"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/schedule_dream",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/schedule_dream",
    "summary": "Schedule Dream",
    "group": "queue",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "ScheduleDreamRequest",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/scopes",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/scopes",
    "summary": "Get Or Create Scope",
    "group": "scopes",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "ScopeCreate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho scope create <name>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/scopes/list",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/scopes/list",
    "summary": "Get Scopes",
    "group": "scopes",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho scope list"
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/scopes/{scope_id}",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/scopes/{scope_id}",
    "summary": "Get Scope",
    "group": "scopes",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "scope_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/scopes/{scope_id}/sessions",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/scopes/{scope_id}/sessions",
    "summary": "Add Sessions To Scope",
    "group": "scopes",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "ScopeSessionsAdd",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "scope_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho scope add-sessions <name> <ids...>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/scopes/{scope_id}/sessions/list",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/scopes/{scope_id}/sessions/list",
    "summary": "Get Scope Sessions",
    "group": "scopes",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "scope_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho scope sessions <name>"
  },
  {
    "id": "delete:/v3/workspaces/{workspace_id}/scopes/{scope_id}/sessions/{session_id}",
    "method": "DELETE",
    "path": "/v3/workspaces/{workspace_id}/scopes/{scope_id}/sessions/{session_id}",
    "summary": "Remove Session From Scope",
    "group": "scopes",
    "destructive": true,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "scope_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/scopes/{scope_id}/status",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/scopes/{scope_id}/status",
    "summary": "Get Scope Status",
    "group": "scopes",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "scope_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho scope status <name>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/search",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/search",
    "summary": "Search Workspace",
    "group": "workspaces",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "WorkspaceMessageSearchOptions",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho workspace search <query>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions",
    "summary": "Get Or Create Session",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "SessionCreate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho session create <id>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/list",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/list",
    "summary": "Get Sessions",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Options",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho session list"
  },
  {
    "id": "delete:/v3/workspaces/{workspace_id}/sessions/{session_id}",
    "method": "DELETE",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}",
    "summary": "Delete Session",
    "group": "sessions",
    "destructive": true,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho session delete <id>"
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}/sessions/{session_id}",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}",
    "summary": "Update Session",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "SessionUpdate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/{session_id}/clone",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/clone",
    "summary": "Clone Session",
    "group": "sessions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "message_id",
        "in": "query",
        "required": false
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/sessions/{session_id}/context",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/context",
    "summary": "Get Session Context",
    "group": "sessions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "tokens",
        "in": "query",
        "required": false
      },
      {
        "name": "search_query",
        "in": "query",
        "required": false
      },
      {
        "name": "summary",
        "in": "query",
        "required": false
      },
      {
        "name": "peer_target",
        "in": "query",
        "required": false
      },
      {
        "name": "peer_perspective",
        "in": "query",
        "required": false
      },
      {
        "name": "scope",
        "in": "query",
        "required": false
      },
      {
        "name": "sessions",
        "in": "query",
        "required": false
      },
      {
        "name": "limit_to_session",
        "in": "query",
        "required": false
      },
      {
        "name": "search_top_k",
        "in": "query",
        "required": false
      },
      {
        "name": "search_max_distance",
        "in": "query",
        "required": false
      },
      {
        "name": "include_most_frequent",
        "in": "query",
        "required": false
      },
      {
        "name": "max_conclusions",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho session context <id>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/{session_id}/messages",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/messages",
    "summary": "Create Messages For Session",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "MessageBatchCreate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho message create <content>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/list",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/list",
    "summary": "Get Messages",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Options",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "reverse",
        "in": "query",
        "required": false
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho message list"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/upload",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/upload",
    "summary": "Create Messages With File",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/{message_id}",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/{message_id}",
    "summary": "Get Message",
    "group": "sessions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "message_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho message get <id>"
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/{message_id}",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/messages/{message_id}",
    "summary": "Update Message",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "MessageUpdate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "message_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "delete:/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "method": "DELETE",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "summary": "Remove Peers From Session",
    "group": "sessions",
    "destructive": true,
    "hasBody": true,
    "bodySchema": "Peers",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "summary": "Get Session Peers",
    "group": "sessions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": "honcho session peers <id>"
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "summary": "Add Peers To Session",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Peers",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/peers",
    "summary": "Set Session Peers",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "Peers",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/sessions/{session_id}/peers/{peer_id}/config",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/peers/{peer_id}/config",
    "summary": "Get Peer Config",
    "group": "sessions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "put:/v3/workspaces/{workspace_id}/sessions/{session_id}/peers/{peer_id}/config",
    "method": "PUT",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/peers/{peer_id}/config",
    "summary": "Set Peer Config",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "SessionPeerConfig",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      },
      {
        "name": "peer_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/sessions/{session_id}/search",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/search",
    "summary": "Search Session",
    "group": "sessions",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "MessageSearchOptions",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho session search <id> <query>"
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/sessions/{session_id}/summaries",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/sessions/{session_id}/summaries",
    "summary": "Get Session Summaries",
    "group": "sessions",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "session_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": "honcho session summaries <id>"
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/webhooks",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/webhooks",
    "summary": "List Webhook Endpoints",
    "group": "webhooks",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "page",
        "in": "query",
        "required": false
      },
      {
        "name": "size",
        "in": "query",
        "required": false
      }
    ],
    "cli": ""
  },
  {
    "id": "post:/v3/workspaces/{workspace_id}/webhooks",
    "method": "POST",
    "path": "/v3/workspaces/{workspace_id}/webhooks",
    "summary": "Get Or Create Webhook Endpoint",
    "group": "webhooks",
    "destructive": false,
    "hasBody": true,
    "bodySchema": "WebhookEndpointCreate",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "get:/v3/workspaces/{workspace_id}/webhooks/test",
    "method": "GET",
    "path": "/v3/workspaces/{workspace_id}/webhooks/test",
    "summary": "Test Emit",
    "group": "webhooks",
    "destructive": false,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  },
  {
    "id": "delete:/v3/workspaces/{workspace_id}/webhooks/{endpoint_id}",
    "method": "DELETE",
    "path": "/v3/workspaces/{workspace_id}/webhooks/{endpoint_id}",
    "summary": "Delete Webhook Endpoint",
    "group": "webhooks",
    "destructive": true,
    "hasBody": false,
    "bodySchema": "",
    "params": [
      {
        "name": "workspace_id",
        "in": "path",
        "required": true
      },
      {
        "name": "endpoint_id",
        "in": "path",
        "required": true
      }
    ],
    "cli": ""
  }
];

export const OP_GROUPS = ["conclusions", "health", "keys", "peers", "queue", "scopes", "sessions", "webhooks", "workspaces"] as const;
