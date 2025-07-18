#!/usr/bin/env python3
"""
GitHub Copilot Integration for Security Scanner
Provides AI-powered security fix suggestions using GitHub Copilot
"""

import subprocess
import json
import os
import re
import tempfile
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import threading
import time

@dataclass
class CopilotSuggestion:
    """Copilot-generated suggestion for security fix"""
    issue_id: str
    suggestion_text: str
    code_example: str
    explanation: str
    confidence: str
    source: str
    generated_at: str
    automated_fix_available: bool
    fix_pattern: Optional[str] = None
    replacement_pattern: Optional[str] = None

@dataclass
class SecurityContext:
    """Security context for vulnerability"""
    threat_description: str
    impact_level: str
    compliance_standards: List[str]
    recommended_tools: List[str]
    prevention_tips: List[str]

class CopilotSuggestionEngine:
    """GitHub Copilot integration for security suggestions"""
    
    def __init__(self, cache_dir: str = "copilot_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Cache settings
        self.cache_duration = timedelta(hours=24)
        self.suggestion_cache = {}
        
        # Check Copilot availability
        self.copilot_available = self._check_copilot_availability()
        
        # Security context database
        self.security_contexts = self._load_security_contexts()
        
        # Automated fix patterns
        self.fix_patterns = self._load_fix_patterns()
        
        print(f"✅ Copilot Suggestion Engine initialized")
        print(f"   • Copilot available: {self.copilot_available}")
        print(f"   • Cache directory: {self.cache_dir}")
    
    def _check_copilot_availability(self) -> bool:
        """Check if GitHub Copilot CLI is available"""
        try:
            # Check if GitHub CLI is installed
            result = subprocess.run(['gh', '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                print("❌ GitHub CLI not found. Please install: https://cli.github.com/")
                return False
            
            # Check if Copilot extension is installed
            result = subprocess.run(['gh', 'extension', 'list'], 
                                  capture_output=True, text=True, timeout=5)
            if 'copilot' not in result.stdout:
                print("❌ GitHub Copilot extension not found. Install with: gh extension install github/gh-copilot")
                return False
            
            return True
            
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("❌ GitHub CLI not available or timed out")
            return False
    
    def _load_security_contexts(self) -> Dict[str, SecurityContext]:
        """Load security contexts for different vulnerability types"""
        return {
            'python-hardcoded-secrets': SecurityContext(
                threat_description="Hardcoded secrets can be extracted from source code, leading to unauthorized access",
                impact_level="CRITICAL",
                compliance_standards=["OWASP A02:2021", "PCI DSS 3.4", "ISO 27001"],
                recommended_tools=["python-decouple", "python-dotenv", "HashiCorp Vault", "AWS Secrets Manager"],
                prevention_tips=[
                    "Use environment variables for sensitive data",
                    "Implement secret management systems",
                    "Use configuration files outside source control",
                    "Implement secret scanning in CI/CD pipelines"
                ]
            ),
            'python-sql-injection': SecurityContext(
                threat_description="SQL injection allows attackers to manipulate database queries and access sensitive data",
                impact_level="CRITICAL",
                compliance_standards=["OWASP A03:2021", "ISO 27001", "PCI DSS 6.5.1"],
                recommended_tools=["SQLAlchemy", "Django ORM", "psycopg2", "PyMySQL"],
                prevention_tips=[
                    "Always use parameterized queries",
                    "Implement input validation and sanitization",
                    "Use ORM frameworks when possible",
                    "Apply principle of least privilege for database access"
                ]
            ),
            'javascript-eval-usage': SecurityContext(
                threat_description="eval() executes arbitrary JavaScript code, enabling code injection attacks",
                impact_level="HIGH",
                compliance_standards=["OWASP A03:2021", "CSP Level 3"],
                recommended_tools=["JSON.parse", "Function constructor", "safe-eval library"],
                prevention_tips=[
                    "Use JSON.parse() for parsing JSON data",
                    "Use Function constructor for dynamic functions",
                    "Implement Content Security Policy",
                    "Validate and sanitize all user input"
                ]
            ),
            'python-weak-crypto': SecurityContext(
                threat_description="Weak cryptographic algorithms can be broken, compromising data confidentiality",
                impact_level="HIGH",
                compliance_standards=["OWASP A02:2021", "FIPS 140-2", "Common Criteria"],
                recommended_tools=["hashlib", "cryptography", "PyNaCl", "bcrypt"],
                prevention_tips=[
                    "Use SHA-256 or stronger hashing algorithms",
                    "Implement proper key management",
                    "Use established cryptographic libraries",
                    "Regular security audits of cryptographic implementations"
                ]
            ),
            'cross-lang-time-bomb': SecurityContext(
                threat_description="Time-based logic bombs can cause system disruption at predetermined times",
                impact_level="HIGH",
                compliance_standards=["ISO 27001", "NIST Cybersecurity Framework"],
                recommended_tools=["cron", "celery", "APScheduler", "cloud schedulers"],
                prevention_tips=[
                    "Use proper scheduling systems instead of hardcoded dates",
                    "Implement code review processes",
                    "Use static analysis tools to detect suspicious patterns",
                    "Implement logging and monitoring for time-based operations"
                ]
            )
        }
    
    def _load_fix_patterns(self) -> Dict[str, Dict[str, Any]]:
        """Load automated fix patterns for common vulnerabilities"""
        return {
            'python-hardcoded-secrets': {
                'pattern': r'(password|secret|key|token|api_key)\s*=\s*["\']([^"\']+)["\']',
                'replacement': r'\1 = os.getenv("\1".upper(), "\2")',
                'imports': ['import os'],
                'confidence': 'high',
                'description': 'Replace hardcoded secrets with environment variables'
            },
            'python-sql-injection': {
                'pattern': r'execute\s*\(\s*["\'](.*)%s(.*)["\']',
                'replacement': r'execute("\1%s\2", (param,))',
                'imports': [],
                'confidence': 'medium',
                'description': 'Convert to parameterized query'
            },
            'javascript-eval-usage': {
                'pattern': r'eval\s*\(\s*([^)]+)\s*\)',
                'replacement': r'JSON.parse(\1)',
                'imports': [],
                'confidence': 'medium',
                'description': 'Replace eval with JSON.parse for data parsing'
            },
            'python-weak-crypto': {
                'pattern': r'(hashlib\.md5|hashlib\.sha1)\s*\(',
                'replacement': r'hashlib.sha256(',
                'imports': ['import hashlib'],
                'confidence': 'high',
                'description': 'Replace weak hash algorithm with SHA-256'
            }
        }
    
    def generate_security_suggestion(self, issue, code_snippet: str, 
                                   file_context: str = None) -> CopilotSuggestion:
        """Generate comprehensive security suggestion using Copilot"""
        
        # Check cache first
        cache_key = self._generate_cache_key(issue.id, code_snippet)
        cached_suggestion = self._get_cached_suggestion(cache_key)
        if cached_suggestion:
            return cached_suggestion
        
        # Generate new suggestion
        suggestion = self._generate_new_suggestion(issue, code_snippet, file_context)
        
        # Cache the result
        self._cache_suggestion(cache_key, suggestion)
        
        return suggestion
    
    def _generate_new_suggestion(self, issue, code_snippet: str, 
                               file_context: str = None) -> CopilotSuggestion:
        """Generate a new suggestion using Copilot"""
        
        suggestion_text = ""
        code_example = ""
        explanation = ""
        confidence = "medium"
        source = "template"
        
        # Try Copilot first if available
        if self.copilot_available:
            try:
                copilot_result = self._query_copilot(issue, code_snippet, file_context)
                if copilot_result['success']:
                    suggestion_text = copilot_result['suggestion']
                    code_example = copilot_result['code_example']
                    explanation = copilot_result['explanation']
                    confidence = "high"
                    source = "github_copilot"
                    
            except Exception as e:
                print(f"⚠️ Copilot query failed: {e}")
        
        # Fallback to template-based suggestion
        if not suggestion_text:
            template_result = self._generate_template_suggestion(issue, code_snippet)
            suggestion_text = template_result['suggestion']
            code_example = template_result['code_example']
            explanation = template_result['explanation']
        
        # Check for automated fix availability
        fix_pattern = self.fix_patterns.get(issue.rule_id)
        automated_fix_available = fix_pattern is not None
        
        return CopilotSuggestion(
            issue_id=issue.id,
            suggestion_text=suggestion_text,
            code_example=code_example,
            explanation=explanation,
            confidence=confidence,
            source=source,
            generated_at=datetime.now().isoformat(),
            automated_fix_available=automated_fix_available,
            fix_pattern=fix_pattern.get('pattern') if fix_pattern else None,
            replacement_pattern=fix_pattern.get('replacement') if fix_pattern else None
        )
    
    def _query_copilot(self, issue, code_snippet: str, 
                      file_context: str = None) -> Dict[str, Any]:
        """Query GitHub Copilot for security fix suggestions"""
        
        # Create a structured prompt for Copilot
        prompt = self._create_copilot_prompt(issue, code_snippet, file_context)
        
        # Create temporary file with the prompt
        temp_file = self._create_temp_file(prompt, issue.file_path)
        
        try:
            # Use GitHub Copilot CLI to get suggestions
            result = subprocess.run([
                'gh', 'copilot', 'suggest', 
                '--type', 'gh',
                f'Fix this security vulnerability: {issue.message}'
            ], input=prompt, capture_output=True, text=True, timeout=45)
            
            if result.returncode == 0:
                return self._parse_copilot_response(result.stdout)
            else:
                print(f"⚠️ Copilot command failed: {result.stderr}")
                return {'success': False}
                
        except subprocess.TimeoutExpired:
            print("⚠️ Copilot query timed out")
            return {'success': False}
        except Exception as e:
            print(f"⚠️ Copilot query error: {e}")
            return {'success': False}
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
    
    def _create_copilot_prompt(self, issue, code_snippet: str, 
                              file_context: str = None) -> str:
        """Create a structured prompt for Copilot"""
        
        security_context = self.security_contexts.get(issue.rule_id)
        
        prompt = f"""
# Security Vulnerability Fix Request

## Issue Details
- **Rule**: {issue.rule_id}
- **Type**: {issue.type}
- **Severity**: {issue.severity}
- **Message**: {issue.message}
- **File**: {issue.file_path}
- **Line**: {issue.line_number}

## Vulnerable Code
```{self._get_file_extension(issue.file_path)}
{code_snippet}
```

## Security Context
{f"**Threat**: {security_context.threat_description}" if security_context else ""}
{f"**Impact**: {security_context.impact_level}" if security_context else ""}

## Request
Please provide:
1. **Secure replacement code** with proper implementation
2. **Explanation** of why the original code is vulnerable
3. **Prevention tips** for avoiding similar issues in the future

Focus on practical, production-ready security fixes.
"""
        
        return prompt
    
    def _create_temp_file(self, content: str, original_file: str) -> str:
        """Create a temporary file with the prompt content"""
        
        file_ext = self._get_file_extension(original_file)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix=file_ext, delete=False) as f:
            f.write(content)
            return f.name
    
    def _get_file_extension(self, file_path: str) -> str:
        """Get file extension for syntax highlighting"""
        ext = Path(file_path).suffix
        return ext if ext else '.txt'
    
    def _parse_copilot_response(self, response: str) -> Dict[str, Any]:
        """Parse Copilot response and extract components"""
        
        lines = response.strip().split('\n')
        
        # Extract different sections
        suggestion = ""
        code_example = ""
        explanation = ""
        
        current_section = None
        code_block = False
        
        for line in lines:
            line = line.strip()
            
            # Detect code blocks
            if line.startswith('```'):
                code_block = not code_block
                continue
                
            # Detect sections
            if line.lower().startswith('explanation:') or 'why' in line.lower():
                current_section = 'explanation'
                continue
            elif line.lower().startswith('fix:') or 'secure' in line.lower():
                current_section = 'suggestion'
                continue
            elif code_block:
                code_example += line + '\n'
                continue
            
            # Add content to appropriate section
            if current_section == 'explanation':
                explanation += line + ' '
            elif current_section == 'suggestion':
                suggestion += line + ' '
            else:
                suggestion += line + ' '
        
        return {
            'success': True,
            'suggestion': suggestion.strip() or "Security fix required",
            'code_example': code_example.strip(),
            'explanation': explanation.strip() or "This code contains a security vulnerability"
        }
    
    def _generate_template_suggestion(self, issue, code_snippet: str) -> Dict[str, Any]:
        """Generate template-based suggestion as fallback"""
        
        templates = {
            'python-hardcoded-secrets': {
                'suggestion': 'Replace hardcoded secrets with environment variables or secure configuration management',
                'code_example': '''import os
from decouple import config

# Instead of hardcoded secrets:
# SECRET_KEY = "hardcoded_secret_value"

# Use environment variables:
SECRET_KEY = os.getenv("SECRET_KEY")
# Or use python-decouple:
SECRET_KEY = config("SECRET_KEY")''',
                'explanation': 'Hardcoded secrets in source code can be easily discovered by attackers. Use environment variables or secure configuration management systems.'
            },
            'python-sql-injection': {
                'suggestion': 'Use parameterized queries or ORM methods to prevent SQL injection attacks',
                'code_example': '''import sqlite3

# Vulnerable code:
# cursor.execute("SELECT * FROM users WHERE name = '%s'" % user_input)

# Secure code using parameterized queries:
cursor.execute("SELECT * FROM users WHERE name = ?", (user_input,))

# Or using named parameters:
cursor.execute("SELECT * FROM users WHERE name = :name", {"name": user_input})''',
                'explanation': 'SQL injection occurs when user input is directly concatenated into SQL queries. Always use parameterized queries to separate SQL code from data.'
            },
            'javascript-eval-usage': {
                'suggestion': 'Replace eval() with safer alternatives like JSON.parse() or Function constructor',
                'code_example': '''// Vulnerable code:
// eval(userInput);

// For JSON parsing:
const data = JSON.parse(jsonString);

// For dynamic functions (use with caution):
const func = new Function('param', 'return param * 2');

// For mathematical expressions, use a math library:
const result = math.evaluate(expression);''',
                'explanation': 'eval() executes arbitrary JavaScript code, making it vulnerable to code injection attacks. Use specific parsers or safer alternatives.'
            },
            'python-weak-crypto': {
                'suggestion': 'Replace weak cryptographic algorithms with stronger alternatives',
                'code_example': '''import hashlib
import bcrypt

# Instead of weak algorithms:
# hash_value = hashlib.md5(data).hexdigest()
# hash_value = hashlib.sha1(data).hexdigest()

# Use stronger algorithms:
hash_value = hashlib.sha256(data).hexdigest()
hash_value = hashlib.sha3_256(data).hexdigest()

# For password hashing, use bcrypt:
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())''',
                'explanation': 'MD5 and SHA-1 are cryptographically weak and vulnerable to collision attacks. Use SHA-256 or stronger algorithms.'
            }
        }
        
        template = templates.get(issue.rule_id, {
            'suggestion': 'Review and fix this security vulnerability according to security best practices',
            'code_example': '// Implement secure coding practices\n// Follow OWASP guidelines',
            'explanation': 'This code contains a security vulnerability that should be addressed according to security best practices.'
        })
        
        return template
    
    def _generate_cache_key(self, issue_id: str, code_snippet: str) -> str:
        """Generate cache key for suggestion"""
        content = f"{issue_id}:{code_snippet}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _get_cached_suggestion(self, cache_key: str) -> Optional[CopilotSuggestion]:
        """Get cached suggestion if available and not expired"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                # Check if cache is still valid
                generated_at = datetime.fromisoformat(data['generated_at'])
                if datetime.now() - generated_at < self.cache_duration:
                    return CopilotSuggestion(**data)
                else:
                    # Remove expired cache
                    cache_file.unlink()
                    
            except Exception as e:
                print(f"⚠️ Cache read error: {e}")
                # Remove corrupted cache
                cache_file.unlink()
        
        return None
    
    def _cache_suggestion(self, cache_key: str, suggestion: CopilotSuggestion):
        """Cache suggestion to disk"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        try:
            with open(cache_file, 'w') as f:
                json.dump(asdict(suggestion), f, indent=2)
        except Exception as e:
            print(f"⚠️ Cache write error: {e}")
    
    def get_security_context(self, rule_id: str) -> Optional[SecurityContext]:
        """Get security context for a rule"""
        return self.security_contexts.get(rule_id)
    
    def generate_automated_fix(self, issue, code_snippet: str) -> Dict[str, Any]:
        """Generate automated fix if available"""
        
        fix_pattern = self.fix_patterns.get(issue.rule_id)
        if not fix_pattern:
            return {'available': False, 'reason': 'No automated fix pattern available'}
        
        try:
            # Apply the fix pattern
            import re
            pattern = fix_pattern['pattern']
            replacement = fix_pattern['replacement']
            
            if re.search(pattern, code_snippet):
                fixed_code = re.sub(pattern, replacement, code_snippet)
                
                return {
                    'available': True,
                    'original_code': code_snippet,
                    'fixed_code': fixed_code,
                    'required_imports': fix_pattern.get('imports', []),
                    'confidence': fix_pattern.get('confidence', 'medium'),
                    'description': fix_pattern.get('description', 'Automated security fix applied')
                }
            else:
                return {'available': False, 'reason': 'Pattern does not match current code'}
                
        except Exception as e:
            return {'available': False, 'reason': f'Fix generation failed: {str(e)}'}
    
    def bulk_generate_suggestions(self, issues: List, max_workers: int = 5) -> Dict[str, CopilotSuggestion]:
        """Generate suggestions for multiple issues concurrently"""
        
        results = {}
        
        def process_issue(issue_data):
            issue, code_snippet = issue_data
            try:
                suggestion = self.generate_security_suggestion(issue, code_snippet)
                results[issue.id] = suggestion
            except Exception as e:
                print(f"⚠️ Error processing issue {issue.id}: {e}")
        
        # Process issues in parallel
        import concurrent.futures
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            issue_data_list = []
            for issue in issues:
                # Get code snippet for each issue
                code_snippet = self._get_code_snippet(issue.file_path, issue.line_number)
                issue_data_list.append((issue, code_snippet))
            
            # Submit all tasks
            futures = [executor.submit(process_issue, issue_data) for issue_data in issue_data_list]
            
            # Wait for completion
            concurrent.futures.wait(futures)
        
        return results
    
    def _get_code_snippet(self, file_path: str, line_number: int, context_lines: int = 5) -> str:
        """Get code snippet around the specified line"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            start = max(0, line_number - context_lines - 1)
            end = min(len(lines), line_number + context_lines)
            
            return ''.join(lines[start:end])
            
        except Exception as e:
            print(f"⚠️ Error reading file {file_path}: {e}")
            return ""
    
    def clear_cache(self):
        """Clear all cached suggestions"""
        try:
            for cache_file in self.cache_dir.glob("*.json"):
                cache_file.unlink()
            print("✅ Cache cleared successfully")
        except Exception as e:
            print(f"⚠️ Error clearing cache: {e}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            cache_files = list(self.cache_dir.glob("*.json"))
            total_size = sum(f.stat().st_size for f in cache_files)
            
            return {
                'total_entries': len(cache_files),
                'total_size_bytes': total_size,
                'total_size_mb': total_size / (1024 * 1024),
                'cache_directory': str(self.cache_dir)
            }
        except Exception as e:
            return {'error': str(e)}


# Example usage
if __name__ == "__main__":
    # Initialize the Copilot suggestion engine
    copilot_engine = CopilotSuggestionEngine()
    
    # Example issue for testing
    class MockIssue:
        def __init__(self):
            self.id = "test-issue-1"
            self.rule_id = "python-hardcoded-secrets"
            self.message = "Hardcoded secret detected"
            self.severity = "CRITICAL"
            self.type = "VULNERABILITY"
            self.file_path = "test.py"
            self.line_number = 10
    
    # Test suggestion generation
    issue = MockIssue()
    code_snippet = 'SECRET_KEY = "hardcoded_secret_value"'
    
    print("🧪 Testing Copilot suggestion generation...")
    suggestion = copilot_engine.generate_security_suggestion(issue, code_snippet)
    
    print(f"\n📋 Generated Suggestion:")
    print(f"Source: {suggestion.source}")
    print(f"Confidence: {suggestion.confidence}")
    print(f"Automated fix available: {suggestion.automated_fix_available}")
    print(f"\n💡 Suggestion: {suggestion.suggestion_text}")
    print(f"\n🔧 Code example:\n{suggestion.code_example}")
    print(f"\n📖 Explanation: {suggestion.explanation}")
    
    # Test automated fix
    print(f"\n🔄 Testing automated fix...")
    fix_result = copilot_engine.generate_automated_fix(issue, code_snippet)
    print(f"Fix available: {fix_result['available']}")
    if fix_result['available']:
        print(f"Fixed code: {fix_result['fixed_code']}")
    
    # Cache stats
    print(f"\n📊 Cache statistics:")
    cache_stats = copilot_engine.get_cache_stats()
    print(f"Entries: {cache_stats['total_entries']}")
    print(f"Size: {cache_stats['total_size_mb']:.2f} MB")
    
    print(f"\n✅ Copilot integration test completed!")