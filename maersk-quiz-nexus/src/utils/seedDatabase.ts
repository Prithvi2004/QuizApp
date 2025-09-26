import { supabase } from "@/integrations/supabase/client";

export const seedDatabase = async () => {
  try {
    // Create demo quizzes
    const demoQuizzes = [
      {
        title: "Maersk Maritime Knowledge",
        description:
          "Test your knowledge about maritime operations and Maersk history",
        difficulty: "Medium",
        category: "Maritime",
        time_limit: 300,
        is_published: true,
        questions: [
          {
            id: "1",
            question: "In what year was A.P. Moller - Maersk founded?",
            options: ["1904", "1912", "1920", "1928"],
            correctAnswer: 0,
          },
          {
            id: "2",
            question:
              "What is the largest container ship class operated by Maersk?",
            options: [
              "Triple E Class",
              "Ultra Large Container Vessel",
              "Emma Maersk Class",
              "MSC Gülsün Class",
            ],
            correctAnswer: 0,
          },
          {
            id: "3",
            question: "Which color is associated with Maersk containers?",
            options: ["Red", "Blue", "Green", "Yellow"],
            correctAnswer: 1,
          },
          {
            id: "4",
            question: "What does TEU stand for in shipping?",
            options: [
              "Total Equipment Unit",
              "Twenty-foot Equivalent Unit",
              "Transport Efficiency Unit",
              "Terminal Exchange Unit",
            ],
            correctAnswer: 1,
          },
          {
            id: "5",
            question: "Where is Maersk headquarters located?",
            options: [
              "Oslo, Norway",
              "Hamburg, Germany",
              "Copenhagen, Denmark",
              "Stockholm, Sweden",
            ],
            correctAnswer: 2,
          },
        ],
      },
      {
        title: "Supply Chain Fundamentals",
        description: "Essential concepts in modern supply chain management",
        difficulty: "Easy",
        category: "Logistics",
        time_limit: 240,
        is_published: true,
        questions: [
          {
            id: "6",
            question: "What is the primary goal of supply chain management?",
            options: [
              "Minimize costs",
              "Maximize efficiency",
              "Optimize end-to-end value delivery",
              "Reduce inventory",
            ],
            correctAnswer: 2,
          },
          {
            id: "7",
            question:
              "Which term describes goods in process of being transported?",
            options: ["Inventory", "Stock", "Cargo", "Freight"],
            correctAnswer: 3,
          },
          {
            id: "8",
            question: "What does JIT stand for in logistics?",
            options: [
              "Just In Time",
              "Joint Inventory Tracking",
              "Journey Integration Technology",
              "Job Information Terminal",
            ],
            correctAnswer: 0,
          },
        ],
      },
      {
        title: "Advanced Maritime Operations",
        description:
          "Complex scenarios in maritime operations and port management",
        difficulty: "Hard",
        category: "Operations",
        time_limit: 600,
        is_published: true,
        questions: [
          {
            id: "9",
            question:
              "What is the maximum draft of a Triple E class container ship?",
            options: [
              "14.5 meters",
              "16.0 meters",
              "17.5 meters",
              "19.0 meters",
            ],
            correctAnswer: 1,
          },
          {
            id: "10",
            question:
              "Which port is considered the busiest container port in the world?",
            options: [
              "Port of Singapore",
              "Port of Shanghai",
              "Port of Los Angeles",
              "Port of Hamburg",
            ],
            correctAnswer: 1,
          },
          {
            id: "11",
            question: "What is the purpose of ballast water in ships?",
            options: [
              "Cooling systems",
              "Stability and trim",
              "Fuel storage",
              "Waste management",
            ],
            correctAnswer: 1,
          },
        ],
      },
    ];

    // Get the current user (admin)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("No authenticated user found");
    }

    // Insert demo quizzes
    for (const quiz of demoQuizzes) {
      const { error } = await supabase.from("quizzes").insert({
        ...quiz,
        created_by: user.id,
      });

      if (error) {
        console.error("Error inserting quiz:", error);
      } else {
        console.log(`Inserted quiz: ${quiz.title}`);
      }
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

