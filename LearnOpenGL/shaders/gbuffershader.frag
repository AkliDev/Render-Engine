#version 330 core
layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gAlbedoSpec;


struct DirLight 
{
    vec3 direction;
  
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

#define NR_POINT_LIGHTS 1 
struct PointLight 
{    
    vec3 position;
	vec3 color;
    
    float constant;
    float linear;
    float quadratic;  

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};  

struct SpotLight 
{
	vec3 position;
    vec3 direction; 
	float cutOff;
	float outerCutOff;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

	float constant;
    float linear;
    float quadratic;
};

in VS_LIGHTS_OUT
{
	in SpotLight SpotLight;  
	in DirLight DirLight; 
	in PointLight PointLights[NR_POINT_LIGHTS];
	in vec3 TangentLightPos [NR_POINT_LIGHTS];
} fs_lights_in;

in VS_OUT 
{
	in vec3 CameraPos;
	in vec3 TangentCameraPos;
	in vec3 FragPosView;	
	in vec3 FragPosWorld;
	in vec3 TangentFragPos;
	in vec3 NormalView;
	in vec3 NormalWorld;
	in vec2 TexCoords;
	in vec4 FragPosLightSpace;	
	in mat4 Model;
	in mat4 View;
	in mat3 TBN;
} fs_in;

struct Material 
{	
    sampler2D texture_diffuse; 
	sampler2D texture_specular;
	sampler2D texture_reflection;
	sampler2D texture_normal;
	sampler2D texture_depth;

    float     shininess;
	float	  heightscale;
}; 
  
uniform Material material;
vec2 texCoords;


vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{ 
    // number of depth layers
    const float minLayers = 80;
    const float maxLayers = 320;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir))); 

    //calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy / viewDir.z * material.heightscale; 
    vec2 deltaTexCoords = P / numLayers;

    // get initial values
    vec2  currentTexCoords     = texCoords;
	float currentDepthMapValue = texture(material.texture_depth, currentTexCoords).r;
      
    while(currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = texture(material.texture_depth, currentTexCoords).r;  
        // get depth of next layer
        currentLayerDepth += layerDepth;  
    }

     
    // get texture coordinates before collision (reverse operations)
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(material.texture_depth, prevTexCoords).r - currentLayerDepth + layerDepth;
 
    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

    return finalTexCoords;
}

void main()
{   
	texCoords = fs_in.TexCoords;

	// offset texture coordinates with Parallax Mapping
	vec3 viewDir = normalize(fs_in.TangentCameraPos - fs_in.TangentFragPos); // tangent space view direction
	texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);       
    if(texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;

	// obtain normal from normal map in range [0,1]
    vec3 norm = normalize(texture(material.texture_normal, texCoords).rgb);
    // transform normal vector to range [-1,1]
	norm = texture(material.texture_normal, texCoords).rgb;
	norm = normalize(norm * 2.0 - 1.0); 

	//transform normal from tangent to model space
	norm = normalize(fs_in.TBN * norm);

	//norm.y = -norm.y;

	// store the fragment position vector in the first gbuffer texture
    gPosition = vec4(fs_in.FragPosWorld,1);
    // also store the per-fragment normals into the gbuffer
    gNormal = vec4(normalize(norm),1);
    // and the diffuse per-fragment color
    gAlbedoSpec.rgb = texture(material.texture_diffuse, texCoords).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    gAlbedoSpec.a = texture(material.texture_specular, texCoords).r;

}