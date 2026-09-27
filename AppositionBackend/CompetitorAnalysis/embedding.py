# We need a function to collect the user query

def collect_user_idea():
    user_idea = {
        "AppName": input("Enter the name of your app idea: ").strip(),
        "Description": input("Enter your idea: ").strip(),
        "Features": [
            feature.strip() # Get rid of whitespace around the feature
            for feature in input("Enter the features of your idea (comma-separated): ").split(",")
            if feature.strip()
        ],
        "Target_Audience": input("Enter the target audience of your idea: ").strip()
    }

    return user_idea
 # Simple flow controller so we don't run all the code at once when we import this module. It will only run if we execute this file directly.

if __name__ == "__main__":
    print(collect_user_idea())