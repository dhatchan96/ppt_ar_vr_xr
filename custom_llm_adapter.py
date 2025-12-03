"""Custom LLM adapter for APIs using CrewAI's BaseLLM."""
import logging
import httpx
from typing import Any, Dict, List, Optional, Union
from crewai import BaseLLM

logger = logging.getLogger(__name__)


class CustomLLMAdapter(BaseLLM):
    """
    Custom LLM adapter for APIs that return LangChain AIMessage format or OpenAI format.
    
    This adapter properly extends CrewAI's BaseLLM to ensure CrewAI recognizes it
    and doesn't wrap it in its own OpenAI provider.
    """
    
    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str,
        temperature: Optional[float] = None,
        http_client: Optional[httpx.Client] = None
    ):
        # CRITICAL: Call parent constructor with required parameters
        super().__init__(model=model, temperature=temperature)
        
        self.api_key = api_key
        self.base_url = base_url
        self.http_client = http_client
    
    def call(
        self,
        messages: Union[str, List[Dict[str, str]]],
        tools: Optional[List[dict]] = None,
        callbacks: Optional[List[Any]] = None,
        available_functions: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> Union[str, Any]:
        """
        Call the LLM with the given messages.
        
        Args:
            messages: String or list of message dicts with 'role' and 'content'
            tools: Optional list of tool definitions
            callbacks: Optional callbacks
            available_functions: Optional dict of available functions
            **kwargs: Additional keyword arguments (e.g., from_task) that CrewAI may pass
            
        Returns:
            String response from the LLM
        """
        # Convert string to message format if needed
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        
        # Prepare request payload
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
        }
        
        # Add stop words if supported
        if self.stop and self.supports_stop_words():
            payload["stop"] = self.stop
        
        # Add tools if provided and supported
        if tools and self.supports_function_calling():
            payload["tools"] = tools
        
        # Make API request
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Determine endpoint - handle various base_url formats
        # If base_url is already a complete endpoint, use it as-is
        base = self.base_url.rstrip('/')
        
        # Check if base_url already contains the full endpoint path
        if "/chat/completions" in base:
            # Already a complete endpoint, use as-is
            endpoint = base
        elif base.endswith("/chat"):
            # Base URL ends with /chat, append /completions (not /chat/completions)
            endpoint = f"{base}/completions"
        elif "/v1/chat" in base:
            # Versioned API with /chat, append /completions
            endpoint = f"{base}/completions"
        elif "/v1" in base or "/api/v1" in base:
            # Versioned API without /chat, append /chat/completions
            endpoint = f"{base}/chat/completions"
        else:
            # Default: assume base_url is complete endpoint, use as-is
            # This handles cases where the base_url is already the full endpoint
            endpoint = base
        
        # Use provided http_client or create a new one
        client = self.http_client or httpx.Client()
        
        # Configure timeout: 30s connect, 120s read (LLM APIs can be slow)
        timeout = httpx.Timeout(30.0, read=120.0)
        
        # Log the request for debugging
        logger.debug(f"Making LLM request to: {endpoint}")
        logger.debug(f"Request payload: model={payload.get('model')}, messages_count={len(payload.get('messages', []))}")
        
        try:
            response = client.post(endpoint, headers=headers, json=payload, timeout=timeout)
            response.raise_for_status()
            response_data = response.json()
            
            # Handle different response formats
            # Check for LangChain AIMessage format first (has "content" and "type" fields)
            if "content" in response_data and "type" in response_data and response_data.get("type") == "ai":
                # This is LangChain AIMessage format
                content = response_data.get("content", "")
            elif "choices" in response_data and len(response_data["choices"]) > 0:
                # This is OpenAI API format
                content = response_data["choices"][0]["message"]["content"]
            elif "content" in response_data:
                # Fallback: just has content field
                content = response_data.get("content", "")
            else:
                # Try to extract content from various possible formats
                content = response_data.get("text") or response_data.get("message") or str(response_data)
            
            # Handle function calling if present
            if "choices" in response_data and len(response_data["choices"]) > 0:
                message = response_data["choices"][0]["message"]
                if "tool_calls" in message and available_functions:
                    return self._handle_function_calls(
                        message["tool_calls"], messages, tools, available_functions
                    )
            
            # Return string content (required by CrewAI)
            return content if isinstance(content, str) else str(content)
            
        except httpx.TimeoutException as e:
            raise RuntimeError(f"LLM request timed out after 120s. Endpoint: {endpoint}. Error: {str(e)}")
        except httpx.ConnectError as e:
            raise RuntimeError(f"Failed to connect to LLM endpoint: {endpoint}. Error: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"LLM API returned error {e.response.status_code}: {e.response.text[:200]}. Endpoint: {endpoint}")
        except httpx.HTTPError as e:
            raise RuntimeError(f"LLM request failed: {str(e)}. Endpoint: {endpoint}")
        except (KeyError, IndexError) as e:
            raise ValueError(f"Invalid response format: {str(e)}. Response: {response_data if 'response_data' in locals() else 'N/A'}")
        finally:
            # Only close if we created the client
            if not self.http_client and client:
                client.close()
    
    def _handle_function_calls(
        self,
        tool_calls: List[dict],
        messages: List[Dict[str, str]],
        tools: Optional[List[dict]],
        available_functions: Dict[str, Any]
    ) -> str:
        """Handle function calling with proper message flow."""
        import json
        
        for tool_call in tool_calls:
            function_name = tool_call["function"]["name"]
            
            if function_name in available_functions:
                # Parse and execute function
                function_args = json.loads(tool_call["function"]["arguments"])
                function_result = available_functions[function_name](**function_args)
                
                # Add function call and result to message history
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [tool_call]
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": function_name,
                    "content": str(function_result)
                })
                
                # Call LLM again with updated context
                return self.call(messages, tools, None, available_functions)
        
        return "Function call failed"
    
    def supports_function_calling(self) -> bool:
        """Return True if your LLM supports function calling."""
        return True
    
    def supports_stop_words(self) -> bool:
        """Return True if your LLM supports stop sequences."""
        return True
    
    def get_context_window_size(self) -> int:
        """Return the context window size of your LLM."""
        return 8192  # Adjust based on your model's actual context window

