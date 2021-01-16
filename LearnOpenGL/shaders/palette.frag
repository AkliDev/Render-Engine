#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D image;
uniform sampler2D palette;
uniform vec3 spriteColor;

void main()
{    
    vec4 base = texture(image, TexCoords);
	vec4 swapColor = texture(palette, vec2(base.r,0));
	vec4 result = mix(base ,swapColor ,swapColor.a);
	result.a = base.a;
	color = result;
}  