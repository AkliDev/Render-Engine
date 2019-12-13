#include "Game.h"

#include "game.h"
#include "ResourceManager.h"
#include "SpriteRenderer.h"

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>


Game::Game(GLuint width, GLuint height)
	: State(GAME_ACTIVE), Keys(), Width(width), Height(height)
{

}

Game::~Game()
{

}

SpriteRenderer  *Renderer;

void Game::Init()
{
	// Load shaders
	ResourceManager::LoadShader("Shaders/sprite.vert", "Shaders/sprite.frag", nullptr, "sprite");
	// Configure shaders
	glm::mat4 projection = glm::ortho(0.0f, static_cast<GLfloat>(this->Width), static_cast<GLfloat>(this->Height), 0.0f, -1.0f, 1.0f);
	ResourceManager::GetShader("sprite").Use().setInt("image", 0);
	ResourceManager::GetShader("sprite").setMat4("projection", projection);

	// Set render-specific controls
	Renderer = new SpriteRenderer(ResourceManager::GetShader("sprite"));
	// Load textures
	ResourceManager::LoadTexture("textures/awesomeface.png", GL_TRUE, "face");
}

void Game::ProcessInput(GLfloat dt)
{

}

void Game::Update(GLfloat dt)
{

}

void Game::Render()
{

}
