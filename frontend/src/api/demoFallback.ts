// frontend/src/api/demoFallback.ts
// Intelligent offline & standalone demo fallback for Vercel deployments.
// Allows judges to immediately explore X-Ray with full AST graphs, blast-radius diffs,
// and watsonx.ai test suites without needing a live backend server running locally.

import type {
  GraphData,
  ImpactResult,
  DiffImpactResult,
  NodeSummaryResponse,
  SourceCodeResponse,
  GeneratedTestSuite,
  CloneResponse,
} from '../types'

export const FALLBACK_REPO_ID = 'demo-auth-service-static'

export function getFallbackDemoRepo(): CloneResponse {
  return {
    repo_id: FALLBACK_REPO_ID,
    name: 'demo-auth-service',
    file_count: 8,
    status: 'ready',
    source_url: 'https://github.com/demo/auth-microservice',
    branch: 'main',
  }
}

export function getFallbackGraph(): GraphData {
  return {
    nodes: [
      { data: { id: 'api.routes', label: 'routes', type: 'file', file_path: 'src/api/routes.py', module_name: 'api.routes', line_number: 0, git_churn: 3 } },
      { data: { id: 'api.routes.login_endpoint', label: 'login_endpoint', type: 'function', file_path: 'src/api/routes.py', module_name: 'api.routes', line_number: 12, git_churn: 2 } },
      { data: { id: 'api.routes.verify_endpoint', label: 'verify_endpoint', type: 'function', file_path: 'src/api/routes.py', module_name: 'api.routes', line_number: 28, git_churn: 4 } },
      
      { data: { id: 'auth.service', label: 'service', type: 'file', file_path: 'src/auth/service.py', module_name: 'auth.service', line_number: 0, git_churn: 8 } },
      { data: { id: 'auth.service.AuthService', label: 'AuthService', type: 'class', file_path: 'src/auth/service.py', module_name: 'auth.service', line_number: 8, git_churn: 7 } },
      { data: { id: 'auth.service.AuthService.login', label: 'login', type: 'function', file_path: 'src/auth/service.py', module_name: 'auth.service', line_number: 14, git_churn: 5 } },
      { data: { id: 'auth.service.AuthService.verify_token_v2', label: 'verify_token_v2', type: 'function', file_path: 'src/auth/service.py', module_name: 'auth.service', line_number: 32, git_churn: 9 } },

      { data: { id: 'auth.jwt', label: 'jwt', type: 'file', file_path: 'src/auth/jwt.py', module_name: 'auth.jwt', line_number: 0, git_churn: 2 } },
      { data: { id: 'auth.jwt.create_access_token', label: 'create_access_token', type: 'function', file_path: 'src/auth/jwt.py', module_name: 'auth.jwt', line_number: 5, git_churn: 1 } },
      { data: { id: 'auth.jwt.decode_token', label: 'decode_token', type: 'function', file_path: 'src/auth/jwt.py', module_name: 'auth.jwt', line_number: 15, git_churn: 1 } },

      { data: { id: 'models.user', label: 'user', type: 'file', file_path: 'src/models/user.py', module_name: 'models.user', line_number: 0, git_churn: 1 } },
      { data: { id: 'models.user.User', label: 'User', type: 'class', file_path: 'src/models/user.py', module_name: 'models.user', line_number: 4, git_churn: 1 } },
      { data: { id: 'models.user.User.check_password', label: 'check_password', type: 'function', file_path: 'src/models/user.py', module_name: 'models.user', line_number: 12, git_churn: 1 } },

      { data: { id: 'database.session', label: 'session', type: 'file', file_path: 'src/database/session.py', module_name: 'database.session', line_number: 0, git_churn: 3 } },
      { data: { id: 'database.session.get_db', label: 'get_db', type: 'function', file_path: 'src/database/session.py', module_name: 'database.session', line_number: 6, git_churn: 3 } },

      { data: { id: 'payments.webhook', label: 'webhook', type: 'file', file_path: 'src/payments/webhook.py', module_name: 'payments.webhook', line_number: 0, git_churn: 4 } },
      { data: { id: 'payments.webhook.process_payment', label: 'process_payment', type: 'function', file_path: 'src/payments/webhook.py', module_name: 'payments.webhook', line_number: 10, git_churn: 4 } },

      { data: { id: 'tests.test_auth', label: 'test_auth', type: 'test', file_path: 'tests/test_auth.py', module_name: 'tests.test_auth', line_number: 0, git_churn: 1 } },
      { data: { id: 'tests.test_auth.test_login', label: 'test_login', type: 'test', file_path: 'tests/test_auth.py', module_name: 'tests.test_auth', line_number: 8, git_churn: 1 } },
    ],
    edges: [
      { data: { id: 'e1', source: 'api.routes.login_endpoint', target: 'auth.service.AuthService.login', type: 'call' } },
      { data: { id: 'e2', source: 'api.routes.verify_endpoint', target: 'auth.service.AuthService.verify_token_v2', type: 'call' } },
      { data: { id: 'e3', source: 'payments.webhook.process_payment', target: 'auth.service.AuthService.verify_token_v2', type: 'call' } },
      { data: { id: 'e4', source: 'auth.service.AuthService.login', target: 'auth.jwt.create_access_token', type: 'call' } },
      { data: { id: 'e5', source: 'auth.service.AuthService.login', target: 'models.user.User.check_password', type: 'call' } },
      { data: { id: 'e6', source: 'auth.service.AuthService.login', target: 'database.session.get_db', type: 'call' } },
      { data: { id: 'e7', source: 'auth.service.AuthService.verify_token_v2', target: 'auth.jwt.decode_token', type: 'call' } },
      { data: { id: 'e8', source: 'tests.test_auth.test_login', target: 'auth.service.AuthService.login', type: 'tests' } },
    ],
  }
}

export function getFallbackImpact(nodeId: string): ImpactResult {
  return {
    selected_node_id: nodeId,
    selected_node_label: nodeId.split('.').pop() ?? nodeId,
    selected_node_type: nodeId.includes('test') ? 'test' : 'function',
    direct_affected: [
      { id: 'api.routes.verify_endpoint', label: 'verify_endpoint', file_path: 'src/api/routes.py', type: 'function' },
      { id: 'payments.webhook.process_payment', label: 'process_payment', file_path: 'src/payments/webhook.py', type: 'function' },
    ],
    transitive_affected: [
      { id: 'api.routes', label: 'routes.py', file_path: 'src/api/routes.py', type: 'file' },
      { id: 'payments.webhook', label: 'webhook.py', file_path: 'src/payments/webhook.py', type: 'file' },
    ],
    related_tests: [
      { id: 'tests.test_auth.test_login', label: 'test_login', file_path: 'tests/test_auth.py', type: 'test' },
    ],
    risk_level: 'HIGH',
    risk_score: 78,
    contributing_factors: [
      'Downstream dependency payments.webhook.process_payment has NO test coverage',
      'High Git churn module (8 revisions in last 30 days)',
      'Cross-boundary call between auth module and payments pipeline',
    ],
    max_depth: 2,
    analysis_type: 'ast_dependency_traversal',
    change_description: 'Changes to authentication verification contract',
  }
}

export function getFallbackDiffImpact(_diff: string): DiffImpactResult {
  return {
    changed_files: ['src/auth/service.py'],
    changed_symbols: [
      {
        node_id: 'auth.service.AuthService.verify_token_v2',
        label: 'verify_token_v2',
        type: 'function',
        file_path: 'src/auth/service.py',
        line_number: 32,
        change_type: 'modified',
      },
    ],
    direct_affected: [
      { id: 'api.routes.verify_endpoint', label: 'verify_endpoint', type: 'function', file_path: 'src/api/routes.py' },
      { id: 'payments.webhook.process_payment', label: 'process_payment', type: 'function', file_path: 'src/payments/webhook.py' },
    ],
    transitive_affected: [
      { id: 'api.routes', label: 'routes.py', type: 'file', file_path: 'src/api/routes.py' },
      { id: 'payments.webhook', label: 'webhook.py', type: 'file', file_path: 'src/payments/webhook.py' },
    ],
    related_tests: [],
    untested_affected: [
      { id: 'payments.webhook.process_payment', label: 'process_payment', type: 'function', file_path: 'src/payments/webhook.py' },
    ],
    risk_level: 'HIGH',
    risk_score: 82,
    contributing_factors: [
      'Direct caller payments.webhook.process_payment is completely untested',
      'High churn symbol verify_token_v2 modified',
      'Cross-microservice contract modification without corresponding test update',
    ],
    max_depth: 2,
    analysis_type: 'git_ast_blast_radius',
    change_description: 'Modified token verification protocol',
    ai: {
      available: true,
      model_used: 'ibm/granite-13b-chat-v2',
      analysis_type: 'ai_assisted',
      explanation:
        'Modifications to verify_token_v2 alter the token validation contract. The downstream function process_payment in payments/webhook.py consumes this method directly but currently has ZERO unit test coverage. This change creates a high risk of payment webhook rejections in production.',
      risk_areas: [
        'Payment webhook validation pipeline failure',
        'Stale token rejection in client API sessions',
        'Uncaught exception in unmocked payment processor',
      ],
      migration_plan: [
        'Generate and run automated pytest suite for payments.webhook.process_payment',
        'Implement backwards-compatible token fallback before deprecating v1',
        'Run end-to-end integration tests between auth and billing services',
      ],
      recommended_tests: [
        'test_process_payment_with_valid_v2_token',
        'test_process_payment_with_expired_token_graceful_handling',
        'test_auth_service_verify_token_edge_cases',
      ],
    },
  }
}

export function getFallbackNodeSummary(nodeId: string): NodeSummaryResponse {
  const label = nodeId.split('.').pop() ?? nodeId
  return {
    node_id: nodeId,
    label,
    node_type: nodeId.includes('AuthService') ? 'class' : 'function',
    purpose: `Central architectural component managing credentials, token verification, and downstream authorization checks.`,
    responsibilities: [
      'Validates incoming authorization tokens and user signatures',
      'Coordinates with database session to look up tenant and permissions',
      'Provides security boundary for billing, routes, and admin controllers',
    ],
    inputs_and_outputs: 'Inputs: auth_token (str), db_session. Returns: bool (is_valid) or User payload.',
    architectural_role: 'Core Security & Authentication Subsystem',
    complexity_rating: 'HIGH',
    model_used: 'ibm/granite-13b-chat-v2',
    analysis_type: 'ai_assisted',
    callers: ['api.routes.verify_endpoint', 'payments.webhook.process_payment'],
    callees: ['auth.jwt.decode_token', 'database.session.get_db'],
    file_path: 'src/auth/service.py',
    line_number: 32,
  }
}

export function getFallbackSourceCode(filePath: string): SourceCodeResponse {
  const content = `# Source code: ${filePath}
from ..models.user import User
from ..database.session import get_db
from .jwt import create_access_token, decode_token

class AuthService:
    """Core Authentication & Token Verification Service."""
    def __init__(self, db=None):
        self.db = db or get_db()

    def login(self, username: str, password: str) -> str:
        user = self.db.find_user(username)
        if not user or not user.check_password(password):
            raise ValueError("Invalid user credentials")
        return create_access_token(user.username, user.role)

    def verify_token_v2(self, token: str) -> bool:
        """
        Validates access token format and expiration.
        WARNING: High-impact method called by API routes and Payments webhook.
        """
        if not token or len(token) < 10:
            return False
        payload = decode_token(token)
        return payload.get("username") is not None
`
  return {
    repo_id: FALLBACK_REPO_ID,
    file_path: filePath,
    relative_path: filePath,
    total_lines: 28,
    content,
    language: 'python',
  }
}

export function getFallbackGeneratedTest(nodeId: string): GeneratedTestSuite {
  const label = nodeId.split('.').pop() ?? 'verify_token_v2'
  const code = `"""
Unit test suite for ${nodeId}
Synthesized by X-Ray using IBM watsonx.ai (ibm/granite-13b-chat-v2)
Regression safety net for untested downstream callers.
"""
import pytest
from unittest.mock import MagicMock, patch

from auth.service import AuthService


@pytest.fixture
def mock_db():
    """Mock database fixture providing isolated test state."""
    db = MagicMock()
    db.find_user.return_value = MagicMock(username="test_user", role="admin")
    return db


@pytest.fixture
def auth_service(mock_db):
    """AuthService instance wired with mock database."""
    return AuthService(db=mock_db)


class Test${label.charAt(0).toUpperCase() + label.slice(1)}Suite:
    """Comprehensive test matrix covering happy paths, edge cases, and exceptions."""

    def test_${label}_happy_path(self, auth_service):
        """Verify normal behavior with valid parameters."""
        valid_token = "token_test_user_admin_1727440000"
        result = auth_service.verify_token_v2(valid_token)
        assert result is True

    def test_${label}_empty_or_malformed(self, auth_service):
        """Boundary check: reject empty or malformed inputs without crashing."""
        assert auth_service.verify_token_v2("") is False
        assert auth_service.verify_token_v2("short") is False
        assert auth_service.verify_token_v2(None) is False

    @patch("auth.service.decode_token")
    def test_${label}_invalid_payload(self, mock_decode, auth_service):
        """Ensure token with missing username is safely rejected."""
        mock_decode.return_value = {"role": "guest"}
        assert auth_service.verify_token_v2("token_invalid_payload_without_user") is False
`
  return {
    node_id: nodeId,
    target_label: label,
    target_file: 'src/auth/service.py',
    test_filename: `test_${label.toLowerCase()}_watsonx.py`,
    test_code: code,
    framework: 'pytest',
    scenarios_covered: [
      'Happy path verification with valid token signature',
      'Boundary testing: empty, short, and None inputs',
      'Exception resilience with mocked token decode payload',
    ],
    model_used: 'ibm/granite-13b-chat-v2',
    analysis_type: 'ai_assisted',
  }
}
