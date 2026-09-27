// frontend/src/api/demoFallback.ts
// Intelligent offline & standalone demo fallback for Vercel deployments.
// Uses the REAL 233-node, 410-edge AST architecture graph of yt-music with deep relationships.

import type {
  GraphData,
  ImpactResult,
  DiffImpactResult,
  NodeSummaryResponse,
  SourceCodeResponse,
  GeneratedTestSuite,
  CloneResponse,
} from '../types'

import ytMusicGraphData from './ytMusicGraph.json'

export const FALLBACK_REPO_ID = 'demo-yt-music'

export function getFallbackDemoRepo(): CloneResponse {
  return {
    repo_id: FALLBACK_REPO_ID,
    name: 'yt-music',
    file_count: 12,
    status: 'ready',
    source_url: 'https://github.com/Jayvirsinh270/yt-music.git',
    branch: 'main',
  }
}

export function getFallbackGraph(_repoId: string = ''): GraphData {
  return ytMusicGraphData as unknown as GraphData
}

export function getFallbackImpact(nodeId: string): ImpactResult {
  const label = nodeId.split('.').pop() ?? nodeId
  const isDb = nodeId.includes('get_db') || nodeId.includes('db_store')
  const isServer = nodeId.includes('start_server') || nodeId.includes('main')

  if (isDb) {
    return {
      selected_node_id: nodeId,
      selected_node_label: label,
      selected_node_type: 'function',
      direct_affected: [
        { id: 'web_app.stream_audio_route', label: 'stream_audio_route', file_path: 'src/web_app.py', type: 'function' },
        { id: 'library_service.fetch_user_library', label: 'fetch_user_library', file_path: 'src/library_service.py', type: 'function' },
        { id: 'smart_playlists.generate_smart_mix', label: 'generate_smart_mix', file_path: 'src/smart_playlists.py', type: 'function' },
        { id: 'downloader.cache_track_metadata', label: 'cache_track_metadata', file_path: 'src/downloader.py', type: 'function' },
      ],
      transitive_affected: [
        { id: 'recommendation_engine.get_personalized_queue', label: 'get_personalized_queue', file_path: 'src/recommendation_engine.py', type: 'function' },
        { id: 'lyrics_aligner.align_subtitles', label: 'align_subtitles', file_path: 'src/lyrics_aligner.py', type: 'function' },
      ],
      related_tests: [
        { id: 'test_forced_alignment_system.test_db_isolation', label: 'test_db_isolation', file_path: 'src/test_forced_alignment_system.py', type: 'test' },
      ],
      risk_level: 'HIGH',
      risk_score: 94,
      contributing_factors: [
        'Critical core database factory with 54 downstream callers across the entire service',
        'Direct callers in web_app.py and smart_playlists.py have unmocked database session dependencies',
        'High Git churn component with 8 recent commit revisions',
        'Cross-boundary propagation from database persistence to streaming controller',
      ],
      max_depth: 3,
      analysis_type: 'ast_dependency_traversal',
      change_description: 'Modifications to central database connection factory get_db',
    }
  }

  if (isServer) {
    return {
      selected_node_id: nodeId,
      selected_node_label: label,
      selected_node_type: 'function',
      direct_affected: [
        { id: 'web_app.init_flask_app', label: 'init_flask_app', file_path: 'src/web_app.py', type: 'function' },
        { id: 'discord_rpc.update_presence_loop', label: 'update_presence_loop', file_path: 'src/discord_rpc.py', type: 'function' },
      ],
      transitive_affected: [
        { id: 'web_app.stream_audio_route', label: 'stream_audio_route', file_path: 'src/web_app.py', type: 'function' },
      ],
      related_tests: [],
      risk_level: 'HIGH',
      risk_score: 85,
      contributing_factors: [
        'Runtime socket and port listener binding modified (5000 -> 8080)',
        'Direct caller web_app.init_flask_app has NO test coverage for port 8080',
        'Breaks existing reverse proxies and client apps expecting port 5000',
      ],
      max_depth: 2,
      analysis_type: 'ast_dependency_traversal',
      change_description: 'Modified server port to 8080',
    }
  }

  // Dynamic impact fallback
  return {
    selected_node_id: nodeId,
    selected_node_label: label,
    selected_node_type: 'function',
    direct_affected: [
      { id: 'web_app.stream_audio_route', label: 'stream_audio_route', file_path: 'src/web_app.py', type: 'function' },
      { id: 'recommendation_engine.get_personalized_queue', label: 'get_personalized_queue', file_path: 'src/recommendation_engine.py', type: 'function' },
    ],
    transitive_affected: [
      { id: 'smart_playlists.generate_smart_mix', label: 'generate_smart_mix', file_path: 'src/smart_playlists.py', type: 'function' },
    ],
    related_tests: [],
    risk_level: 'MEDIUM',
    risk_score: 68,
    contributing_factors: [
      'Caller in web_app.py relies on synchronous return value',
      'AST dependency path connects to audio playback pipeline',
    ],
    max_depth: 2,
    analysis_type: 'ast_dependency_traversal',
    change_description: `Modifications to ${label}`,
  }
}

export function getFallbackDiffImpact(diff: string): DiffImpactResult {
  const isPortDiff = diff.includes('8080') || diff.includes('start_server') || diff.includes('main.py')

  if (isPortDiff) {
    return {
      changed_files: ['src/main.py'],
      changed_symbols: [
        {
          node_id: 'main.start_server',
          label: 'start_server',
          type: 'function',
          file_path: 'src/main.py',
          line_number: 10,
          change_type: 'modified',
        },
      ],
      direct_affected: [
        { id: 'web_app.init_flask_app', label: 'init_flask_app', type: 'function', file_path: 'src/web_app.py' },
        { id: 'discord_rpc.update_presence_loop', label: 'update_presence_loop', type: 'function', file_path: 'src/discord_rpc.py' },
      ],
      transitive_affected: [
        { id: 'web_app.stream_audio_route', label: 'stream_audio_route', type: 'function', file_path: 'src/web_app.py' },
        { id: 'recommendation_engine.get_personalized_queue', label: 'get_personalized_queue', type: 'function', file_path: 'src/recommendation_engine.py' },
      ],
      related_tests: [],
      untested_affected: [
        { id: 'web_app.init_flask_app', label: 'init_flask_app', type: 'function', file_path: 'src/web_app.py' },
        { id: 'discord_rpc.update_presence_loop', label: 'update_presence_loop', type: 'function', file_path: 'src/discord_rpc.py' },
      ],
      risk_level: 'HIGH',
      risk_score: 85,
      contributing_factors: [
        'Direct caller web_app.init_flask_app has NO test coverage for port 8080',
        'Port modification (5000 -> 8080) breaks client web and mobile socket connections',
        'Critical entrypoint symbol main.start_server modified',
      ],
      max_depth: 2,
      analysis_type: 'git_ast_blast_radius',
      change_description: 'Modified server port to 8080',
      ai: {
        available: true,
        model_used: 'ibm/granite-13b-chat-v2',
        analysis_type: 'ai_assisted',
        explanation:
          'A modification inside main.py changes the application runtime port from 5000 to 8080. This change alters the network socket contract. Downstream client endpoints in web_app.py and discord_rpc.py depend on standard port bindings, and current test suites have zero integration tests asserting port 8080 compatibility.',
        risk_areas: [
          'Client connection failure (ECONNREFUSED on port 5000)',
          'Docker container exposed port mismatch if Dockerfile remains port 5000',
          'Untested downstream API listener in web_app.py',
        ],
        migration_plan: [
          'Generate and run pytest suite verifying port binding and socket acceptance on port 8080',
          'Verify reverse proxy configuration (Nginx / Cloudflare) to route to port 8080',
          'Update environment variable configuration fallback PORT=8080',
        ],
        recommended_tests: [
          'test_start_server_binds_to_configured_port',
          'test_client_handshake_on_port_8080',
          'test_environment_override_port_fallback',
        ],
      },
    }
  }

  // Default Recommendation Engine / Database Diff
  return {
    changed_files: ['src/db_store.py'],
    changed_symbols: [
      {
        node_id: 'db_store.get_db',
        label: 'get_db',
        type: 'function',
        file_path: 'src/db_store.py',
        line_number: 14,
        change_type: 'modified',
      },
    ],
    direct_affected: [
      { id: 'web_app.stream_audio_route', label: 'stream_audio_route', type: 'function', file_path: 'src/web_app.py' },
      { id: 'library_service.fetch_user_library', label: 'fetch_user_library', type: 'function', file_path: 'src/library_service.py' },
    ],
    transitive_affected: [
      { id: 'smart_playlists.generate_smart_mix', label: 'generate_smart_mix', type: 'function', file_path: 'src/smart_playlists.py' },
      { id: 'recommendation_engine.get_personalized_queue', label: 'get_personalized_queue', type: 'function', file_path: 'src/recommendation_engine.py' },
    ],
    related_tests: [],
    untested_affected: [
      { id: 'web_app.stream_audio_route', label: 'stream_audio_route', type: 'function', file_path: 'src/web_app.py' },
    ],
    risk_level: 'HIGH',
    risk_score: 92,
    contributing_factors: [
      'Direct caller web_app.stream_audio_route is completely untested',
      'High churn symbol get_db modified with 54 transitive callers',
      'Database connection failure will cause 500 Internal Server Errors across all audio routes',
    ],
    max_depth: 3,
    analysis_type: 'git_ast_blast_radius',
    change_description: 'Modified database connection session manager',
    ai: {
      available: true,
      model_used: 'ibm/granite-13b-chat-v2',
      analysis_type: 'ai_assisted',
      explanation:
        'Modifications to db_store.get_db impact 54 downstream callers across the microservice. The streaming audio endpoint in web_app.py relies on this database session directly, and has zero test coverage.',
      risk_areas: [
        'Database session leak during streaming audio playback',
        'SQLite locking timeout under concurrent playlist writes',
        'Unhandled exception in web_app.py request lifecycle',
      ],
      migration_plan: [
        'Generate and run automated pytest suite for web_app.py database context handling',
        'Verify connection pooling and thread-safe session disposal',
        'Run end-to-end integration tests on audio playback and playlist state',
      ],
      recommended_tests: [
        'test_get_db_session_lifecycle',
        'test_stream_audio_handles_db_disconnect',
        'test_concurrent_playlist_read_write',
      ],
    },
  }
}

export function getFallbackNodeSummary(nodeId: string): NodeSummaryResponse {
  const label = nodeId.split('.').pop() ?? nodeId
  const isDb = nodeId.includes('get_db') || nodeId.includes('db_store')

  return {
    node_id: nodeId,
    label,
    node_type: isDb ? 'function' : 'function',
    purpose: isDb
      ? 'Primary database session factory and state persistence manager for yt-music, managing sqlite connections, thread local sessions, and playlist tables.'
      : `Central architectural component managing execution and downstream service integration for ${label}.`,
    responsibilities: [
      'Executes core logic and validates incoming parameters',
      'Coordinates with subsystem dependencies across architectural boundaries',
      'Maintains operational stability for downstream callers',
    ],
    inputs_and_outputs: 'Inputs: request payload or configuration. Returns: response status or execution state.',
    architectural_role: isDb ? 'Database & Storage Subsystem Layer' : 'Core Architectural Subsystem Component',
    complexity_rating: isDb ? 'HIGH' : 'MEDIUM',
    model_used: 'ibm/granite-13b-chat-v2',
    analysis_type: 'ai_assisted',
    callers: isDb ? ['web_app', 'library_service', 'smart_playlists', 'downloader'] : ['web_app', 'main'],
    callees: isDb ? ['sqlite3.connect', '_auto_migrate_legacy_json'] : ['db_store.get_db'],
    file_path: isDb ? 'src/db_store.py' : 'src/main.py',
    line_number: isDb ? 14 : 10,
  }
}

export function getFallbackSourceCode(filePath: string): SourceCodeResponse {
  if (filePath.includes('main.py')) {
    const mainCode = `# src/main.py
import os
import sys
from web_app import create_app

def start_server():
    """
    Initializes HTTP application server.
    Changed from port 5000 to port 8080.
    """
    port = 8080
    print(f"Starting server on port {port}...")
    app = create_app()
    app.run(host="0.0.0.0", port=port)
    return port

if __name__ == "__main__":
    start_server()
`
    return {
      repo_id: 'yt-music',
      file_path: filePath,
      relative_path: filePath,
      total_lines: 19,
      content: mainCode,
      language: 'python',
    }
  }

  const dbCode = `# src/db_store.py
import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "yt_music.db")

@contextmanager
def get_db():
    """
    Thread-safe SQLite database connection manager.
    Called by 54 components across streaming, playlists, and analytics.
    """
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
`
  return {
    repo_id: 'yt-music',
    file_path: filePath,
    relative_path: filePath,
    total_lines: 34,
    content: dbCode,
    language: 'python',
  }
}

export function getFallbackGeneratedTest(nodeId: string): GeneratedTestSuite {
  const label = nodeId.split('.').pop() ?? 'get_db'
  
  if (label.includes('server') || label.includes('start')) {
    const code = `"""
Unit test suite for ${nodeId}
Synthesized by X-Ray using IBM watsonx.ai (ibm/granite-13b-chat-v2)
Regression safety net for server port and listener binding.
"""
import pytest
from unittest.mock import MagicMock, patch

from main import start_server


class Test${label.charAt(0).toUpperCase() + label.slice(1)}Suite:
    """Automated test suite verifying socket configuration and port 8080 migration."""

    def test_${label}_port_binding(self):
        """Verify server binds to updated port 8080."""
        with patch("main.create_app") as mock_app:
            mock_instance = MagicMock()
            mock_app.return_value = mock_instance
            port = start_server()
            assert port == 8080
            mock_instance.run.assert_called_once_with(host="0.0.0.0", port=8080)

    def test_${label}_environment_override(self):
        """Ensure port configuration gracefully falls back if custom port passed."""
        with patch.dict("os.environ", {"PORT": "8080"}):
            with patch("main.create_app"):
                port = start_server()
                assert port == 8080
`
    return {
      node_id: nodeId,
      target_label: label,
      target_file: 'src/main.py',
      test_filename: `test_${label.toLowerCase()}_watsonx.py`,
      test_code: code,
      framework: 'pytest',
      scenarios_covered: [
        'Port 8080 binding verification',
        'Flask application runner keyword argument assertion',
        'Regression prevention for client socket listeners',
      ],
      model_used: 'ibm/granite-13b-chat-v2',
      analysis_type: 'ai_assisted',
    }
  }

  const code = `"""
Unit test suite for ${nodeId}
Synthesized by X-Ray using IBM watsonx.ai (ibm/granite-13b-chat-v2)
Regression safety net for central database connection manager.
"""
import pytest
import sqlite3
from unittest.mock import patch, MagicMock

from db_store import get_db, init_db


class Test${label.charAt(0).toUpperCase() + label.slice(1)}Suite:
    """Regression test matrix covering connection lifecycle, rollback, and concurrency."""

    def test_${label}_context_manager_commit(self):
        """Verify database transaction commits successfully on normal exit."""
        with get_db() as db:
            assert isinstance(db, sqlite3.Connection)
            db.execute("CREATE TABLE IF NOT EXISTS test_tbl (id INT)")
            db.execute("INSERT INTO test_tbl VALUES (1)")
        
        # Verify persistence
        with get_db() as db:
            cur = db.execute("SELECT id FROM test_tbl WHERE id = 1")
            assert cur.fetchone()[0] == 1

    def test_${label}_rollback_on_exception(self):
        """Verify transaction automatically rolls back if an unhandled error occurs."""
        with pytest.raises(RuntimeError):
            with get_db() as db:
                db.execute("INSERT INTO test_tbl VALUES (999)")
                raise RuntimeError("Simulated failure inside transaction")
        
        with get_db() as db:
            cur = db.execute("SELECT id FROM test_tbl WHERE id = 999")
            assert cur.fetchone() is None
`
  return {
    node_id: nodeId,
    target_label: label,
    target_file: 'src/db_store.py',
    test_filename: `test_${label.toLowerCase()}_watsonx.py`,
    test_code: code,
    framework: 'pytest',
    scenarios_covered: [
      'Database connection lifecycle & context manager auto-close',
      'Transaction auto-commit verification',
      'Transaction auto-rollback on downstream exception',
    ],
    model_used: 'ibm/granite-13b-chat-v2',
    analysis_type: 'ai_assisted',
  }
}
