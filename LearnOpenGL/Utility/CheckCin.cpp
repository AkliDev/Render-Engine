#include <iostream>;

bool CheckCin()
{
	std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

	if (std::cin.fail()) // has a previous extraction failed?
	{
		// yep, so let's handle the failure
		std::cin.clear(); // put us back in 'normal' operation mode
		std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
		std::cout << "Oops, that input is invalid.  Please try again.\n";
		return true;
	}
	else
	{
		return false;
	}
}