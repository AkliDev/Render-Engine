#include <glad/glad.h>
#include <SDL.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <ft2build.h>
#include FT_FREETYPE_H  

#include <random>
#include <iostream>

#include "ResourceManager.h"
#include "Shader.h"
#include "Texture.h"

#include "Camera.h"

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

#include "Model.h"

#include "Utility/Headers/PRNG.h";

#include "Imgui/imgui.h"
#include "Imgui/imgui_impl_opengl3.h"
#include "Imgui/imgui_impl_sdl.h"

#include <stdio.h>
#include <cstdio>
#include <cstdlib>

#include "Game.h"

//callbacks
//void framebuffer_size_callback(GLFWwindow* window, int width, int height);
//void mouse_callback(GLFWwindow* window, double xpos, double ypos);
//void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
void key_callback(SDL_KeyboardEvent event);
void pad_callback(SDL_ControllerButtonEvent event);
unsigned int loadCubemap(std::vector<std::string> faces);

GLenum glCheckError_(const char *file, int line);
#define glCheckError() glCheckError_(__FILE__, __LINE__) 
void APIENTRY glDebugOutput(GLenum source, GLenum type, GLuint id, GLenum severity, GLsizei length, const GLchar *message, const void *userParam);

SDL_Window* gWindow;
SDL_GLContext gl_context;
const char* glsl_version = "#version 450";
bool shouldProgramClose = false;

// settings
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;
float heightScale = 0.3f;
float exposure = 1.0f;

bool guiMode;
bool firstMouse = true;
float lastX = 800.0f / 2.0;
float lastY = 600.0 / 2.0;

float deltaTime = 0.0f;	// Time between current frame and last frame
float lastFrame = 0.0f; // Time of last frame

Game game(SCR_WIDTH, SCR_HEIGHT);

SDL_GameController* gGameController = NULL;
const int JOYSTICK_DEAD_ZONE = 8000;

static void sdl_die(const char * message) {
	fprintf(stderr, "%s: %s\n", message, SDL_GetError());
	exit(2);
}

float lerp(float a, float b, float f)
{
	return a + f * (b - a);
}

void initImGui()
{
	// Setup Dear ImGui context
	IMGUI_CHECKVERSION();
	ImGui::CreateContext();
	ImGuiIO& io = ImGui::GetIO(); (void)io;
	//io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;     // Enable Keyboard Controls
	//io.ConfigFlags |= ImGuiConfigFlags_NavEnableGamepad;      // Enable Gamepad Controls

	// Setup Dear ImGui style
	ImGui::StyleColorsDark();
	//ImGui::StyleColorsClassic();

	// Setup Platform/Renderer bindings
	ImGui_ImplSDL2_InitForOpenGL(gWindow, gl_context);
	ImGui_ImplOpenGL3_Init(glsl_version);
}

bool initGL()
{
	//Initialization flag
	bool success = true;

	// Check OpenGL properties
	printf("OpenGL loaded\n");
	gladLoadGLLoader(SDL_GL_GetProcAddress);
	printf("Vendor:   %s\n", glGetString(GL_VENDOR));
	printf("Renderer: %s\n", glGetString(GL_RENDERER));
	printf("Version:  %s\n", glGetString(GL_VERSION));

	GLint flags; glGetIntegerv(GL_CONTEXT_FLAGS, &flags);
	if (flags & GL_CONTEXT_FLAG_DEBUG_BIT)
	{
		glEnable(GL_DEBUG_OUTPUT);
		glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS);
		glDebugMessageCallback(glDebugOutput, nullptr);
		glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_TRUE);
	}

	//glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
	glDisable(GL_DEPTH_TEST);
	glEnable(GL_STENCIL_TEST);
	glEnable(GL_BLEND);
	glEnable(GL_CULL_FACE);
	glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);
	glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
	//glCullFace(GL_BACK);
	//glFrontFace(GL_CCW);
	//glEnable(GL_PROGRAM_POINT_SIZE);
	//glfwWindowHint(GLFW_SAMPLES, 4);
	//glEnable(GL_MULTISAMPLE);

	return success;
}

bool init(const char * caption)
{
	//Initialization flag
	bool success = true;

	SetSeed();

	// Initialize SDL 
	if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMECONTROLLER) < 0)
		sdl_die("Couldn't initialize SDL");
	atexit(SDL_Quit);
	SDL_GL_LoadLibrary(NULL); // Default OpenGL is fine.

	 // Request an OpenGL 4.5 context (should be core)
	SDL_GL_SetAttribute(SDL_GL_ACCELERATED_VISUAL, 1);
	SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
	SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 5);
	// Also request a depth buffer
	SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
	SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 24);
	SDL_GL_SetAttribute(SDL_GL_STENCIL_SIZE, 8);
	//enable debug context
	SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, SDL_GL_CONTEXT_DEBUG_FLAG);

	gWindow = SDL_CreateWindow(caption, SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED, SCR_WIDTH, SCR_HEIGHT, SDL_WINDOW_OPENGL);

	if (gWindow == NULL) sdl_die("Couldn't set video mode");

	gl_context = SDL_GL_CreateContext(gWindow);
	if (gl_context == NULL)
		sdl_die("Failed to create OpenGL context");

	// Use v-sync
	SDL_GL_SetSwapInterval(1);

	//Initialize OpenGL
	if (!initGL())
	{
		printf("Unable to initialize OpenGL!\n");
		success = false;
	}

	initImGui();
	stbi_set_flip_vertically_on_load(false);
	game.Init();

	//Check for joysticks
	if (SDL_NumJoysticks() < 1)
	{
		printf("Warning: No joysticks connected!\n");
	}
	else
	{
		//Load joystick
		gGameController = SDL_GameControllerOpen(0);
		if (gGameController == NULL)
		{
			printf("Warning: Unable to open game controller! SDL Error: %s\n", SDL_GetError());
		}
	}

	return success;
}

void runGame()
{
	SDL_Event event;
	// render loop
	while (!shouldProgramClose)
	{

		while (SDL_PollEvent(&event))
		{
			ImGui_ImplSDL2_ProcessEvent(&event);
			if (event.type == SDL_QUIT)
				shouldProgramClose = true;
			if (event.type == SDL_WINDOWEVENT && event.window.event == SDL_WINDOWEVENT_CLOSE && event.window.windowID == SDL_GetWindowID(gWindow))
				shouldProgramClose = true;
			if (event.type == SDL_KEYUP || event.type == SDL_KEYDOWN)
				key_callback(event.key);
			if (event.type == SDL_CONTROLLERBUTTONDOWN || event.type == SDL_CONTROLLERBUTTONUP)
				pad_callback(event.cbutton);


		}
		// feed inputs to dear imgui, start new frame
		ImGui_ImplOpenGL3_NewFrame();
		ImGui_ImplSDL2_NewFrame(gWindow);
		ImGui::NewFrame();

		float currentTime = SDL_GetTicks() * 0.001;
		deltaTime = currentTime - lastFrame;
		lastFrame = currentTime;

		// input
		game.ProcessInput(deltaTime);
		game.Update(deltaTime);
		game.Render(currentTime);

		{
			ImGui::Begin("Hello, world!");
			ImGui::Text("Application average %.3f ms/frame (%.1f FPS)", 1000.0f / ImGui::GetIO().Framerate, ImGui::GetIO().Framerate);
			ImGui::End();
		}

		// Render gui
		ImGui::Render();
		ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());

		// swap the buffer
		SDL_GL_SwapWindow(gWindow);
	}
}

void close()
{
	ImGui_ImplOpenGL3_Shutdown();
	ImGui_ImplSDL2_Shutdown();
	ImGui::DestroyContext();

	//Close game controller
	SDL_GameControllerClose(gGameController);
	gGameController = NULL;

	//Destroy window  
	SDL_GL_DeleteContext(gl_context);
	SDL_DestroyWindow(gWindow);
	gWindow = NULL;
	gl_context = NULL;
	SDL_Quit();
}

int main(int argc, char *argv[])
{
	init("Breek Uit");
	runGame();
	close();
	return 0;
}

// renderQuad() renders a 1x1 XY quad in NDC
// -----------------------------------------
unsigned int quadVAO = 0;
unsigned int quadVBO;
void renderQuad()
{
	if (quadVAO == 0)
	{
		float quadVertices[] = {
			// positions        // texture Coords
			-1.0f,  1.0f, 0.0f, 1.0f,
			-1.0f, -1.0f, 0.0f, 0.0f,
			 1.0f,  1.0f, 1.0f, 1.0f,
			 1.0f, -1.0f, 1.0f, 0.0f,
		};
		// setup plane VAO
		glGenVertexArrays(1, &quadVAO);
		glGenBuffers(1, &quadVBO);
		glBindVertexArray(quadVAO);
		glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
		glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);
		glEnableVertexAttribArray(0);
		glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);

	}
	glBindVertexArray(quadVAO);
	glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
	glBindVertexArray(0);
}

void key_callback(SDL_KeyboardEvent key)
{
	if (key.keysym.sym == SDLK_ESCAPE && key.state == SDL_PRESSED)
		shouldProgramClose = true;

	if (key.keysym.sym >= 0 && key.keysym.sym < 1024)
	{
		if (key.state == SDL_PRESSED)
			game.Keys[key.keysym.sym] = GL_TRUE;
		else if (key.state == SDL_RELEASED)
		{
			game.Keys[key.keysym.sym] = GL_FALSE;
			game.KeysProcessed[key.keysym.sym] = GL_FALSE;
		}
	}
}

void pad_callback(SDL_ControllerButtonEvent button)
{
	
	if (button.state == SDL_PRESSED)
	{
		switch (button.button)
		{
		case SDL_CONTROLLER_BUTTON_A:
			game.Keys[SDLK_SPACE] = GL_TRUE;
			break;
		case SDL_CONTROLLER_BUTTON_START:
			game.Keys[SDLK_RETURN] = GL_TRUE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_UP:
			game.Keys[SDLK_w] = GL_TRUE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_DOWN:
			game.Keys[SDLK_s] = GL_TRUE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_LEFT:
			game.Keys[SDLK_a] = GL_TRUE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_RIGHT:
			game.Keys[SDLK_d] = GL_TRUE;
			break;
		}
	}
	else if (button.state == SDL_RELEASED)
	{
		switch (button.button)
		{
		case SDL_CONTROLLER_BUTTON_A:
			game.Keys[SDLK_SPACE] = GL_FALSE;
			game.KeysProcessed[SDLK_SPACE] = GL_FALSE;
			break;
		case SDL_CONTROLLER_BUTTON_START:
			game.Keys[SDLK_RETURN] = GL_FALSE;
			game.KeysProcessed[SDLK_RETURN] = GL_FALSE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_UP:
			game.Keys[SDLK_w] = GL_FALSE;
			game.KeysProcessed[SDLK_w] = GL_FALSE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_DOWN:
			game.Keys[SDLK_s] = GL_FALSE;
			game.KeysProcessed[SDLK_s] = GL_FALSE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_LEFT:
			game.Keys[SDLK_a] = GL_FALSE;
			game.KeysProcessed[SDLK_a] = GL_FALSE;
			break;
		case SDL_CONTROLLER_BUTTON_DPAD_RIGHT:
			game.Keys[SDLK_d] = GL_FALSE;
			game.KeysProcessed[SDLK_d] = GL_FALSE;
			break;
		}
	}

}

// glfw: whenever the mouse moves, this callback is called
// -------------------------------------------------------
//void mouse_callback(GLFWwindow* window, double xpos, double ypos)
//{
//	if (firstMouse)
//	{
//		lastX = xpos;
//		lastY = ypos;
//		firstMouse = false;
//	}
//
//	float xoffset = xpos - lastX;
//	float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top
//	lastX = xpos;
//	lastY = ypos;
//
//
//}

//// glfw: whenever the mouse scroll wheel scrolls, this callback is called
//// ----------------------------------------------------------------------
//void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
//{
//
//}

//void framebuffer_size_callback(GLFWwindow* window, int width, int height)
//{
//	glViewport(0, 0, width, height);
//}

unsigned int loadCubemap(std::vector<std::string> faces)
{
	unsigned int textureID;
	glGenTextures(1, &textureID);
	glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);

	int width, height, nrChannels;
	for (unsigned int i = 0; i < faces.size(); i++)
	{
		unsigned char *data = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 0);
		if (data)
		{
			glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i,
				0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data
			);
			stbi_image_free(data);
		}
		else
		{
			std::cout << "Cubemap texture failed to load at path: " << faces[i] << std::endl;
			stbi_image_free(data);
		}
	}
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);

	return textureID;
}

GLenum glCheckError_(const char *file, int line)
{
	GLenum errorCode;
	while ((errorCode = glGetError()) != GL_NO_ERROR)
	{
		std::string error;
		switch (errorCode)
		{
		case GL_INVALID_ENUM:                  error = "INVALID_ENUM"; break;
		case GL_INVALID_VALUE:                 error = "INVALID_VALUE"; break;
		case GL_INVALID_OPERATION:             error = "INVALID_OPERATION"; break;
		case GL_STACK_OVERFLOW:                error = "STACK_OVERFLOW"; break;
		case GL_STACK_UNDERFLOW:               error = "STACK_UNDERFLOW"; break;
		case GL_OUT_OF_MEMORY:                 error = "OUT_OF_MEMORY"; break;
		case GL_INVALID_FRAMEBUFFER_OPERATION: error = "INVALID_FRAMEBUFFER_OPERATION"; break;
		}
		std::cout << error << " | " << file << " (" << line << ")" << std::endl;
	}
	return errorCode;
}

void APIENTRY glDebugOutput(GLenum source,
	GLenum type,
	GLuint id,
	GLenum severity,
	GLsizei length,
	const GLchar *message,
	const void *userParam)
{
	// ignore non-significant error/warning codes
	if (id == 131169 || id == 131185 || id == 131218 || id == 131204) return;

	std::cout << "---------------" << std::endl;
	std::cout << "Debug message (" << id << "): " << message << std::endl;

	switch (source)
	{
	case GL_DEBUG_SOURCE_API:             std::cout << "Source: API"; break;
	case GL_DEBUG_SOURCE_WINDOW_SYSTEM:   std::cout << "Source: Window System"; break;
	case GL_DEBUG_SOURCE_SHADER_COMPILER: std::cout << "Source: Shader Compiler"; break;
	case GL_DEBUG_SOURCE_THIRD_PARTY:     std::cout << "Source: Third Party"; break;
	case GL_DEBUG_SOURCE_APPLICATION:     std::cout << "Source: Application"; break;
	case GL_DEBUG_SOURCE_OTHER:           std::cout << "Source: Other"; break;
	} std::cout << std::endl;

	switch (type)
	{
	case GL_DEBUG_TYPE_ERROR:               std::cout << "Type: Error"; break;
	case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR: std::cout << "Type: Deprecated Behaviour"; break;
	case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR:  std::cout << "Type: Undefined Behaviour"; break;
	case GL_DEBUG_TYPE_PORTABILITY:         std::cout << "Type: Portability"; break;
	case GL_DEBUG_TYPE_PERFORMANCE:         std::cout << "Type: Performance"; break;
	case GL_DEBUG_TYPE_MARKER:              std::cout << "Type: Marker"; break;
	case GL_DEBUG_TYPE_PUSH_GROUP:          std::cout << "Type: Push Group"; break;
	case GL_DEBUG_TYPE_POP_GROUP:           std::cout << "Type: Pop Group"; break;
	case GL_DEBUG_TYPE_OTHER:               std::cout << "Type: Other"; break;
	} std::cout << std::endl;

	switch (severity)
	{
	case GL_DEBUG_SEVERITY_HIGH:         std::cout << "Severity: high"; break;
	case GL_DEBUG_SEVERITY_MEDIUM:       std::cout << "Severity: medium"; break;
	case GL_DEBUG_SEVERITY_LOW:          std::cout << "Severity: low"; break;
	case GL_DEBUG_SEVERITY_NOTIFICATION: std::cout << "Severity: notification"; break;
	} std::cout << std::endl;
	std::cout << std::endl;
}

