#include "PalettedGameObject.h"



PalettedGameObject::PalettedGameObject(glm::vec2 pos, glm::vec2 size, Texture2D sprite, Texture2D palette, glm::vec3 color, glm::vec2 velocity)
	: GameObject(pos, size, sprite, color, velocity), Palette(palette)
{
}

void PalettedGameObject::Draw(SpriteRenderer &renderer)
{
	renderer.DrawPalettedSprite(this->Sprite, this->Palette, this->Position, this->Size, this->Rotation, this->Color);
}
