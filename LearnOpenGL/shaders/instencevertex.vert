#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;
layout (location = 3) in mat4 instanceModelMatrix;

out vec3 FragPos;
out vec3 Normal;
out vec3 FragPosWorld;
out vec3 NormalWorld;
out vec2 TexCoords;
out mat4 View;

out VS_OUT {
    vec3 normal;
} vs_out;


layout (std140) uniform Matrices
{
    mat4 projection;
    mat4 view;
};

void main()
{
	FragPosWorld = vec3(instanceModelMatrix * vec4(aPos, 1.0));
	NormalWorld = mat3(transpose(inverse(instanceModelMatrix))) * aNormal;

    FragPos = vec3(view * instanceModelMatrix * vec4(aPos, 1.0));
    Normal = mat3(transpose(inverse(view * instanceModelMatrix))) * aNormal;
	
	TexCoords = aTexCoords;
	View = view;

	mat3 normalMatrix = mat3(transpose(inverse(view * instanceModelMatrix)));
    vs_out.normal = normalize(vec3(projection * vec4(normalMatrix * aNormal, 0.0)));

	 gl_Position = projection * view * instanceModelMatrix * vec4(aPos, 1.0);  
} 