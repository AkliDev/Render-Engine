#pragma once
#include "GameObject.h"
class PalettedGameObject :
	public GameObject
{
public:
	Texture2D   Palette;
	PalettedGameObject(glm::vec2 pos, glm::vec2 size, Texture2D sprite, Texture2D palette, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f));

	virtual void Draw(SpriteRenderer &renderer) override;
};

